import { supabase } from './supabase';

const BUCKET = 'designs';

const LIST_COLUMNS_NO_CSS = 'id, created_at, source, framework, template_id, xd_url, image_path, code';
const LIST_COLUMNS = `${LIST_COLUMNS_NO_CSS}, css`;

/*
 * The css column was added after launch. If a database has not had that
 * migration yet, every query naming it fails — which would hide the user's
 * whole history. Detect that one error and retry without the column, so
 * history and saving keep working (minus CSS) until the migration runs.
 */
const isMissingCssColumn = (error) => {
    const message = error?.message || '';
    return /\bcss\b/.test(message) && /does not exist|schema cache/i.test(message);
};

/** data:image/png;base64,... -> Blob, so the upload keeps the original bytes. */
const dataUrlToBlob = async (dataUrl) => (await fetch(dataUrl)).blob();

const extensionFor = (mime) => {
    const ext = (mime || '').split('/')[1] || 'png';
    return ext === 'jpeg' ? 'jpg' : ext.replace(/[^a-z0-9]/gi, '');
};

/** Upload the design image under the user's own folder; returns its object path. */
const uploadDesignImage = async (userId, dataUrl) => {
    const blob = await dataUrlToBlob(dataUrl);
    const path = `${userId}/${crypto.randomUUID()}.${extensionFor(blob.type)}`;
    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: blob.type || 'image/png', upsert: false });
    if (error) throw error;
    return path;
};

/**
 * Save a finished generation. The image upload is best-effort: if storage
 * fails, the markup is still worth keeping, so the row is saved without it.
 */
export const saveGeneration = async (userId, {
    source, framework, provider, model, image, xdUrl, context, templateId, code, css, chat,
}) => {
    let imagePath = null;
    if (source === 'image' && image?.startsWith('data:')) {
        try {
            imagePath = await uploadDesignImage(userId, image);
        } catch (err) {
            console.error('Design image upload failed; saving markup only.', err);
        }
    }

    const row = {
        user_id: userId,
        source,
        framework,
        provider: provider || null,
        model: model || null,
        image_path: imagePath,
        xd_url: xdUrl || null,
        context: context || null,
        template_id: templateId || null,
        code,
        css: css || '',
        chat: chat || [],
    };

    const insert = (withCss) => {
        const values = { ...row };
        if (!withCss) delete values.css;
        return supabase
            .from('generations')
            .insert(values)
            .select(withCss ? LIST_COLUMNS : LIST_COLUMNS_NO_CSS)
            .single();
    };

    let { data, error } = await insert(true);
    if (isMissingCssColumn(error)) ({ data, error } = await insert(false));
    if (error) throw error;
    return data;
};

/** Persist a refinement or CSS edit: the markup, CSS and the whole chat so far. */
export const updateGeneration = async (id, { code, css, chat }) => {
    const update = (values) => supabase.from('generations').update(values).eq('id', id);

    let { error } = await update({ code, css: css || '', chat });
    if (isMissingCssColumn(error)) ({ error } = await update({ code, chat }));
    if (error) throw error;
};

export const HISTORY_PAGE_SIZE = 5;

/**
 * One page of the sidebar list, newest first. Includes the markup so each
 * item can render its thumbnail. Quick Start templates are excluded: they
 * are the same built-in layouts for everyone, not the user's own work.
 * Asks for one row more than the page to learn whether another page exists.
 */
export const listGenerations = async (offset = 0, pageSize = HISTORY_PAGE_SIZE) => {
    const query = (columns) => supabase
        .from('generations')
        .select(columns)
        .neq('source', 'template')
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize);

    let { data, error } = await query(LIST_COLUMNS);
    if (isMissingCssColumn(error)) ({ data, error } = await query(LIST_COLUMNS_NO_CSS));
    if (error) throw error;
    return { items: data.slice(0, pageSize), hasMore: data.length > pageSize };
};

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
});

/**
 * Full row plus its design image as a data URL. A data URL rather than a
 * signed link, so "Regenerate" can send it to any provider and re-save it
 * exactly like a fresh upload.
 */
export const loadGeneration = async (id) => {
    const { data, error } = await supabase
        .from('generations')
        .select('*')
        .eq('id', id)
        .single();
    if (error) throw error;

    let imageUrl = null;
    if (data.image_path) {
        const { data: blob } = await supabase.storage.from(BUCKET).download(data.image_path);
        if (blob) imageUrl = await blobToDataUrl(blob);
    }
    return { ...data, imageUrl };
};

export const deleteGeneration = async ({ id, image_path }) => {
    const { error } = await supabase.from('generations').delete().eq('id', id);
    if (error) throw error;
    if (image_path) {
        // Orphaned images are harmless, so a failed cleanup is not an error.
        await supabase.storage.from(BUCKET).remove([image_path]);
    }
};
