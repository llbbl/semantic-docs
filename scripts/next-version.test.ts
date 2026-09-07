import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/** Runs the release script the way the workflow does: subjects on stdin. */
function nextVersion(
  latestTag: string,
  subjects: string[],
  allowMajor = false,
): Record<string, string> {
  const stdout = execFileSync(
    './scripts/next-version.sh',
    [latestTag, String(allowMajor)],
    { input: subjects.join('\n'), encoding: 'utf8' },
  );

  return Object.fromEntries(
    stdout
      .trim()
      .split('\n')
      .map((line) => line.split('=') as [string, string]),
  );
}

describe('next-version.sh', () => {
  it('should bump the patch for a fix', () => {
    expect(nextVersion('v2.1.0', ['fix: a thing'])).toEqual({
      version: '2.1.1',
      bump: 'patch',
      suppressed_major: 'false',
    });
  });

  it('should bump the minor for a feature', () => {
    expect(nextVersion('v2.1.0', ['feat: a thing'])).toMatchObject({
      version: '2.2.0',
      bump: 'minor',
    });
  });

  it('should bump the minor for a scoped feature', () => {
    expect(nextVersion('v2.1.0', ['feat(theme): a thing'])).toMatchObject({
      version: '2.2.0',
      bump: 'minor',
    });
  });

  it('should NOT bump the major for a breaking change by default', () => {
    expect(nextVersion('v2.1.0', ['feat(search)!: reshape the API'])).toEqual({
      version: '2.2.0',
      bump: 'minor',
      suppressed_major: 'true',
    });
  });

  it.each([
    'feat!: a thing',
    'fix!: a thing',
    'refactor!: a thing',
    'feat(search)!: a thing',
    'chore: mentions BREAKING CHANGE somewhere',
  ])('should suppress the major for %s', (subject) => {
    const result = nextVersion('v2.1.0', [subject]);
    expect(result.bump).toBe('minor');
    expect(result.suppressed_major).toBe('true');
  });

  it('should bump the major only when explicitly allowed', () => {
    expect(
      nextVersion('v2.1.0', ['feat(search)!: reshape the API'], true),
    ).toEqual({
      version: '3.0.0',
      bump: 'major',
      suppressed_major: 'false',
    });
  });

  it('should not invent a major from a non-breaking commit even when allowed', () => {
    expect(nextVersion('v2.1.0', ['feat: a thing'], true)).toMatchObject({
      version: '2.2.0',
      bump: 'minor',
    });
  });

  it('should take the highest bump across a mixed batch', () => {
    expect(
      nextVersion('v2.1.0', ['fix: a', 'feat: b', 'docs: c']),
    ).toMatchObject({ version: '2.2.0', bump: 'minor' });
  });

  it('should suppress the major when a breaking commit is mixed in', () => {
    expect(
      nextVersion('v2.1.0', ['fix: a', 'feat!: b', 'docs: c']),
    ).toMatchObject({ version: '2.2.0', suppressed_major: 'true' });
  });

  it('should treat an unrecognized subject as a patch', () => {
    expect(nextVersion('v2.1.0', ['whatever this is'])).toMatchObject({
      version: '2.1.1',
      bump: 'patch',
    });
  });

  it('should start from zero when no tag exists', () => {
    expect(nextVersion('v0.0.0', ['docs: first'])).toMatchObject({
      version: '0.0.1',
    });
  });
});
