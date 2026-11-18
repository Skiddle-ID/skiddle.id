// Testimonials on the home and services pages (src/lib/testimonials.mjs). `npm run test:unit`.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ratingSummary, reviews, serviceAnchor, serviceKey, serviceOf, stars, testimonialGroups } from '../src/lib/testimonials.mjs';

const services = [{ name: 'Server Setup & Hardening' }, { name: 'CI/CD Implementation' }, { name: 'Self‑Hosting & Homelab Consultation' }];
const t = (serviceName, rating = 5) => ({ quote: 'q', author: 'a', serviceName, rating });

describe('which service a testimonial is about', () => {
  it('matches names whatever their case, spaces or hyphens', () => {
    assert.equal(serviceKey('Self‑Hosting & Homelab Consultation'), serviceKey('self-hosting  &  homelab consultation'));
    assert.equal(serviceOf(services, 'ci/cd implementation')?.name, 'CI/CD Implementation');
    assert.equal(serviceOf(services, 'Consultation'), undefined);
    assert.equal(serviceOf(services, ''), undefined);
  });
  it('gives each service card an id to link to', () => {
    assert.equal(serviceAnchor('CI/CD Implementation'), 'service-ci-cd-implementation');
    assert.equal(serviceAnchor('Self‑Hosting & Homelab Consultation'), 'service-self-hosting-homelab-consultation');
  });
});

describe('ratings', () => {
  it('summarises the count and the average, to one decimal', () => {
    assert.deepEqual(ratingSummary([t('x', 5), t('x', 4)]), { count: 2, average: '4.5' });
    assert.deepEqual(ratingSummary([t('x', 5)]), { count: 1, average: '5.0' });
    assert.equal(ratingSummary([]), null);
  });
  it('draws stars and counts reviews', () => {
    assert.equal(stars(5), '★★★★★');
    assert.equal(stars(3), '★★★☆☆');
    assert.equal(reviews(1), '1 review');
    assert.equal(reviews(4), '4 reviews');
  });
});

describe('groups for the filter', () => {
  it('follows the services’ order, then other names as written, and links only real services', () => {
    const groups = testimonialGroups([t('Consultation', 4), t('CI/CD Implementation'), t('server setup & hardening'), t('CI/CD Implementation', 4)], services);
    assert.deepEqual(
      groups.map((g) => [g.label, g.anchor ?? null, g.count, g.summary.average]),
      [
        ['Server Setup & Hardening', 'service-server-setup-hardening', 1, '5.0'],
        ['CI/CD Implementation', 'service-ci-cd-implementation', 2, '4.5'],
        ['Consultation', null, 1, '4.0'],
      ],
    );
  });
  it('leaves out testimonials about nothing in particular', () => {
    assert.deepEqual(testimonialGroups([t('')], services), []);
  });
});
