export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    '/my-tasks/:path*',
    '/projects/:path*',
    '/notifications/:path*',
  ],
};
