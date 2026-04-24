import { describe, expect } from "vitest";
import { qaTest } from "@/test/qaTest";

import * as CriteriaBarrel from "../criteria/index";
import * as FactoriesBarrel from "../../test/factories/index";
import * as StorageBarrel from "../storage/index";

describe("shared/criteria barrel", () => {
  qaTest("coverage.criteria-barrel.exports", () => {
    expect(CriteriaBarrel).toBeDefined();
    expect(Object.keys(CriteriaBarrel).length).toBeGreaterThan(0);
  });
});

describe("test/factories barrel", () => {
  qaTest("coverage.factories-barrel.exports", () => {
    expect(FactoriesBarrel.buildOrg).toBeDefined();
    expect(FactoriesBarrel.buildJuror).toBeDefined();
    expect(FactoriesBarrel.buildPeriod).toBeDefined();
    expect(FactoriesBarrel.buildProject).toBeDefined();
    expect(FactoriesBarrel.buildScore).toBeDefined();
    expect(FactoriesBarrel.buildUser).toBeDefined();
  });
});

describe("shared/storage barrel", () => {
  qaTest("coverage.storage-barrel.exports", () => {
    expect(StorageBarrel.KEYS).toBeDefined();
    expect(StorageBarrel.getJuryAccess).toBeDefined();
    expect(StorageBarrel.getRawToken).toBeDefined();
  });
});
