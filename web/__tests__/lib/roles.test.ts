import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { CATALOG_MANAGER_ROLES, canManageCatalog } from '@/lib/roles'

describe('canManageCatalog', () => {
  it('admits DESIGNER and ADMIN', () => {
    expect(canManageCatalog('DESIGNER')).toBe(true)
    expect(canManageCatalog('ADMIN')).toBe(true)
  })

  it('refuses BUYER', () => {
    expect(canManageCatalog('BUYER')).toBe(false)
  })

  it('refuses the signed-out and still-loading states rather than throwing', () => {
    // Call sites pass `user?.role` straight through, so these are the common inputs on
    // first render, not edge cases.
    expect(canManageCatalog(null)).toBe(false)
    expect(canManageCatalog(undefined)).toBe(false)
  })
})

describe('CATALOG_MANAGER_ROLES agrees with the server', () => {
  // B-11. The client gate and the server matcher are two hand-maintained copies of one rule, and
  // this repository has been bitten by exactly that before — the `/assets` allow-list drifted
  // across four layers and 404'd every 3D preview in production, which is why
  // AssetExposureConsistencyTest compares the copies instead of re-asserting one of them.
  //
  // This is the same trick in the other direction: read the server's predicate and require it to
  // name the same roles. A client gate that is *narrower* than the server silently hides a
  // capability the operator has; one that is *wider* fronts a 403.
  it('names exactly the roles in the server Role.canManageCatalog() predicate', () => {
    const roleJava = readFileSync(
      join(__dirname, '../../../server/src/main/java/com/iyae/entity/enums/Role.java'),
      'utf8'
    )

    const body = roleJava.match(
      /public boolean canManageCatalog\(\)\s*\{([\s\S]*?)\}/
    )?.[1]
    expect(body, 'could not locate canManageCatalog() in Role.java').toBeTruthy()

    const serverRoles = [...body!.matchAll(/this\s*==\s*([A-Z_]+)/g)].map((m) => m[1])

    expect(serverRoles.length).toBeGreaterThan(0)
    expect([...serverRoles].sort()).toEqual([...CATALOG_MANAGER_ROLES].sort())
  })
})
