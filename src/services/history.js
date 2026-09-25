import { supabase } from './supabase';

const BUCKET = 'designs';

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
    source, framework, provider, model, image, xdUrl, context, templateId, code, chat,
}) => {
    let imagePath = null;
    if (source === 'image' && image?.startsWith('data:')) {
        try {
            imagePath = await uploadDesignImage(userId, image);
        } catch (err) {
            console.error('Design image upload failed; saving markup only.', err);
        }
    }

    const { data, error } = await supabase
        .from('generations')
        .insert({
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
            chat: chat || [],
        })
        .select('id, created_at, source, framework, template_id, xd_url, image_path, code')
        .single();
    if (error) throw error;
    return data;
};

/** Persist a refinement: the new markup and the whole chat so far. */
export const updateGeneration = async (id, { code, chat }) => {
    const { error } = await supabase
        .from('generations')
        .update({ code, chat })
        .eq('id', id);
    if (error) throw error;
};

/** Sidebar list. Includes the markup so each item can render its thumbnail. */
export const listGenerations = async (limit = 50) => {
    const { data, error } = await supabase
        .from('generations')
        .select('id, created_at, source, framework, template_id, xd_url, image_path, code')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return data;
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
