// Public assets must follow the deployment base, including GitHub project Pages.
export function assetUrl(path) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
