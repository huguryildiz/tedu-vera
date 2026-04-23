import { describe, expect } from "vitest";
import { qaTest } from "../../../test/qaTest.js";
import { useToast } from "../useToast.js";
import { toastStore } from "../../lib/toastStore.js";

describe("hooks/useToast", () => {
  qaTest("hooks.useToast.01", () => {
    const toast = useToast();
    const countBefore = toastStore.getAll().filter((t) => !t.exiting).length;
    toast.success("Saved");
    const active = toastStore.getAll().filter((t) => !t.exiting);
    expect(active.length).toBe(countBefore + 1);
    expect(active[active.length - 1].type).toBe("success");
  });

  qaTest("hooks.useToast.02", () => {
    const toast = useToast();
    toast.error("Something went wrong");
    const active = toastStore.getAll().filter((t) => !t.exiting);
    const last = active[active.length - 1];
    expect(last.type).toBe("error");
    expect(last.message.endsWith(".")).toBe(true);
  });
});
