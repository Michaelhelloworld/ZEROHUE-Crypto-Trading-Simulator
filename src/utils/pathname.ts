export const normalizePathname = (pathname: string) => {
  if (!pathname || pathname === '/') {
    return '/';
  }

  const normalizedPath = pathname.replace(/\/+$/, '');
  return normalizedPath || '/';
};
