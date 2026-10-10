import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { LEGAL_PAGES, legalNavigationDenylist } from './legalRoutes';

const publicDir = resolve(__dirname, '../../public');

describe('legal pages', () => {
  it('keeps the service worker from serving the app shell for them', () => {
    const deny = legalNavigationDenylist();
    for (const path of LEGAL_PAGES) {
      expect(deny.some(re => re.test(path))).toBe(true);
    }
    expect(deny.some(re => re.test('/'))).toBe(false);
    expect(deny.some(re => re.test('/privacy.html.evil'))).toBe(false);
    expect(deny.some(re => re.test('/settings'))).toBe(false);
  });

  it('ships both pages as drafts with a contact placeholder', () => {
    for (const path of LEGAL_PAGES) {
      const html = readFileSync(resolve(publicDir, path.slice(1)), 'utf8');
      expect(html).toMatch(/DRAFT/);
      expect(html).toContain('CONTACT_EMAIL');
      expect(html).toContain('href="/legal.css"');
      expect(html).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    }
    const privacy = readFileSync(resolve(publicDir, 'privacy.html'), 'utf8');
    const terms = readFileSync(resolve(publicDir, 'terms.html'), 'utf8');
    expect(privacy).toContain('href="/terms.html"');
    expect(terms).toContain('href="/privacy.html"');
    expect(privacy).toMatch(/Supabase/);
    expect(privacy).toMatch(/Vercel/);
    expect(privacy).toMatch(/push/i);
    expect(privacy).toMatch(/Sentry/);
    expect(privacy).toMatch(/JetBrains Mono ships with the website/);
    expect(privacy).not.toMatch(/Google Fonts|fonts\.googleapis|fonts\.gstatic/);
  });
});
