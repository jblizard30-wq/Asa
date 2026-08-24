import { describe, it, expect } from 'vitest';
import { getLiturgicalSeason } from './liturgicalCalendar';
import type { LiturgicalSeason } from '@prisma/client';

interface TemplateItem {
  title: string;
  season?: LiturgicalSeason | null;
}

function filterItemsForSeason(items: TemplateItem[], season: LiturgicalSeason): TemplateItem[] {
  return items.filter((item) => !item.season || item.season === season);
}

describe('serviceTemplates liturgical filtering', () => {
  const sampleItems: TemplateItem[] = [
    { title: 'Standard Call to Worship', season: null },
    { title: 'Audio / Visual Sound Check', season: null },
    { title: 'Light Advent Wreath Candle', season: 'ADVENT' },
    { title: 'Lenten Confession of Sin', season: 'LENT' },
    { title: 'Easter Lilies & Resurrection Anthem', season: 'EASTER' },
  ];

  it('includes generic items and Advent items during Advent', () => {
    const season = getLiturgicalSeason(new Date('2026-12-06'));
    expect(season).toBe('ADVENT');

    const filtered = filterItemsForSeason(sampleItems, season);
    const titles = filtered.map((i) => i.title);

    expect(titles).toContain('Standard Call to Worship');
    expect(titles).toContain('Audio / Visual Sound Check');
    expect(titles).toContain('Light Advent Wreath Candle');
    expect(titles).not.toContain('Lenten Confession of Sin');
    expect(titles).not.toContain('Easter Lilies & Resurrection Anthem');
  });

  it('includes generic items and Easter items on Easter Sunday', () => {
    const season = getLiturgicalSeason(new Date('2026-04-05'));
    expect(season).toBe('EASTER');

    const filtered = filterItemsForSeason(sampleItems, season);
    const titles = filtered.map((i) => i.title);

    expect(titles).toContain('Standard Call to Worship');
    expect(titles).toContain('Easter Lilies & Resurrection Anthem');
    expect(titles).not.toContain('Light Advent Wreath Candle');
  });

  it('includes only generic items during Ordinary Time', () => {
    const season = getLiturgicalSeason(new Date('2026-08-23'));
    expect(season).toBe('ORDINARY_TIME');

    const filtered = filterItemsForSeason(sampleItems, season);
    const titles = filtered.map((i) => i.title);

    expect(titles).toHaveLength(2);
    expect(titles).toContain('Standard Call to Worship');
    expect(titles).toContain('Audio / Visual Sound Check');
  });
});
