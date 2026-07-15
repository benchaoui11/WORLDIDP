// Always returns a plain 404. Used to hard-block direct, unconditional
// access to the raw _offer/ and _white/ folders (which Vercel would
// otherwise serve as normal static files, completely bypassing gate.js
// and the mode logic — meaning either variant could be reached directly
// by URL regardless of the live mode). Nothing should ever be able to
// see the "other" version of the site except through gate.js.
export const config = { runtime: 'edge' };

export default function handler() {
  return new Response('<!doctype html><title>Not found</title><h1>404</h1>', {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' },
  });
}
