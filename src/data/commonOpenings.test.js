import { describe, expect, test } from 'vitest';
import { getOpeningRepertoireOptions, recommendedTrainingSideForOpening } from './commonOpenings';

describe('recommendedTrainingSideForOpening', () => {
  test('classifies major black openings as black side', () => {
    expect(recommendedTrainingSideForOpening({ name: 'Caro-Kann Defense' })).toBe('b');
    expect(recommendedTrainingSideForOpening({ name: 'Sicilian Defense: Najdorf Variation' })).toBe('b');
    expect(recommendedTrainingSideForOpening({ name: 'French Defense: Advance Variation' })).toBe('b');
    expect(recommendedTrainingSideForOpening({ name: 'Queen\'s Gambit Declined' })).toBe('b');
    expect(recommendedTrainingSideForOpening({ name: 'English Defense' })).toBe('b');
    expect(recommendedTrainingSideForOpening({ name: 'Englund Gambit' })).toBe('b');
  });

  test('classifies major white openings as white side', () => {
    expect(recommendedTrainingSideForOpening({ name: 'English Opening' })).toBe('w');
    expect(recommendedTrainingSideForOpening({ name: 'Grob Opening' })).toBe('w');
    expect(recommendedTrainingSideForOpening({ name: 'Polish Opening: Tartakower Gambit' })).toBe('w');
    expect(recommendedTrainingSideForOpening({ name: 'Bishop\'s Opening: Berlin Defense' })).toBe('w');
    expect(recommendedTrainingSideForOpening({ name: 'King\'s Indian Attack' })).toBe('w');
  });

  test('uses safe white default for unknown names', () => {
    expect(recommendedTrainingSideForOpening({ name: 'Horwitz Attack' })).toBe('w');
    expect(recommendedTrainingSideForOpening({ name: '' })).toBe('w');
    expect(recommendedTrainingSideForOpening({})).toBe('w');
  });

  test('opening side map covers all families in opening files', () => {
    const options = getOpeningRepertoireOptions();
    expect(options.length).toBeGreaterThan(100);
  });
});
