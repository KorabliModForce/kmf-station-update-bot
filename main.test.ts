import { versionCompareFn } from './util.ts'
import { assertEquals } from '@std/assert'

Deno.test('compare versions', () => {
  const versions = ['214123.1', '215555.2', '216666.3']

  assertEquals(versions.sort(versionCompareFn), [
    '216666.3',
    '215555.2',
    '214123.1',
  ])
})
