import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const createdProjects: string[] = [];
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test.afterAll(async () => {
  for (const projectId of createdProjects) {
    const projectPath = path.join(repoRoot, "projects", projectId);
    if (!projectPath.startsWith(path.join(repoRoot, "projects"))) {
      throw new Error(`Refusing to remove unexpected path: ${projectPath}`);
    }
    await fs.rm(projectPath, { recursive: true, force: true });
  }
});

test("project phase workflow smoke", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("DA Workflow")).toBeVisible();
  await expect(page.getByText("New Project")).toBeVisible();

  const projectId = `ux-smoke-${Date.now()}`;
  createdProjects.push(projectId);

  await page.getByPlaceholder("Project name").fill("UX Smoke Project");
  await page.getByPlaceholder("project-id").fill(projectId);
  await page.getByPlaceholder("Owner").fill("QA");
  await page.locator("select").first().selectOption("Grafana");
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.getByText("UX Smoke Project").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Requirement Intake" })).toBeVisible();
  await expect(page.getByText("Phase Gates")).toBeVisible();
  await expect(page.getByText("Work to do")).toBeVisible();
  await expect(page.getByText("Gate readiness")).toBeVisible();

  const phaseHeadings = [
    "Requirement Intake",
    "AI Analysis and Understanding",
    "SQL Draft and Logic Preparation",
    "Dashboard or Report Development",
    "AI Review and Validation",
    "Testing and Verification",
    "Approval and Delivery"
  ];

  for (const heading of phaseHeadings) {
    await page.getByRole("button", { name: new RegExp(heading) }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByText("Work to do", { exact: true })).toBeVisible();
    await expect(page.getByText("Useful uploads", { exact: true })).toBeVisible();
    await expect(page.getByText("Expected output", { exact: true })).toBeVisible();
    await expect(page.getByText("Gate readiness", { exact: true })).toBeVisible();
  }

  await page.getByRole("button", { name: new RegExp("Requirement Intake") }).click();

  await page
    .getByPlaceholder("Add phase notes, stakeholder input, SQL comments, or instructions for this run")
    .fill("Need operational dashboard for request intake smoke test.");
  await page.getByRole("button", { name: "Run Agent" }).click();

  await expect(page.getByText("Agent output generated")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Agent Output", { exact: true })).toBeVisible();
  await expect(page.getByText("Gate blockers remaining")).toBeVisible();
});
