/**
 * Build-time switches. Search engines are kept out until the department
 * launches the site: set PUBLIC_ALLOW_INDEXING=true for the production build.
 */
export const allowIndexing = import.meta.env.PUBLIC_ALLOW_INDEXING === 'true';
