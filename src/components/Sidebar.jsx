import React from 'react';

const Sidebar = ({ children }) => {
    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                {/* alt is empty on purpose: the wordmark beside it already
                    names the product, so announcing both would duplicate. */}
                <img
                    src="/gutendraft.png"
                    alt=""
                    className="logo-mark"
                    width="40"
                    height="40"
                />
            </div>

            <div className="sidebar-body">
                {children}
            </div>
        </aside>
    );
};

export default Sidebar;
