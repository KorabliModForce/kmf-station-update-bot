import { versionCompareFn } from './util.ts'
import { assertEquals } from '@std/assert'

Deno.test('compare versions', () => {
  const versions = ['25.10.214123.1', '25.10.215555.2', '25.10.216666.3', '25.10.8825509.0', '25.11.8828504.0']

  assertEquals(versions.sort(versionCompareFn), [
    '25.11.8828504.0',
    '25.10.8825509.0',
    '25.10.216666.3',
    '25.10.215555.2',
    '25.10.214123.1',
  ])
})
