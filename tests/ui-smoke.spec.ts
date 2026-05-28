import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
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
  await expect(page.getByText("What to do next")).toBeVisible();
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
    await expect(page.getByText("What to do next", { exact: true })).toBeVisible();
    await expect(page.getByText("Work to do", { exact: true })).toBeVisible();
    await expect(page.getByText("Useful uploads", { exact: true })).toBeVisible();
    await expect(page.getByText("Expected output", { exact: true })).toBeVisible();
    await expect(page.getByText("Gate readiness", { exact: true })).toBeVisible();
  }

  await page.getByRole("button", { name: new RegExp("Requirement Intake") }).click();

  await page
    .getByPlaceholder("Add notes, SQL comments, stakeholder input, or instructions for this run")
    .fill("Need operational dashboard for request intake smoke test.");

  const fixtureDir = path.join(repoRoot, "tmp", "ui-test-fixtures");
  await fs.mkdir(fixtureDir, { recursive: true });
  const workbookPath = path.join(fixtureDir, "dashboard-requirements.xlsx");
  execFileSync("py", [
    "-3",
    "-c",
    [
      "from openpyxl import Workbook",
      "wb = Workbook()",
      "ws = wb.active",
      "ws.title = 'Requirements'",
      "ws.append(['Dashboard Name', 'KPI', 'Filter'])",
      "ws.append(['Smoke Dashboard', 'Availability', 'Date Range'])",
      `wb.save(r'${workbookPath.replace(/'/g, "''")}')`
    ].join(";")
  ]);

  await page.locator('input[type="file"]').setInputFiles(workbookPath);

  await expect(page.getByText("uploaded and analyzed")).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("Agent Output", { exact: true })).toBeVisible();
  await expect(page.getByText("Excel workbook")).toBeVisible();
  await expect(page.getByText("Smoke Dashboard")).toBeVisible();
  await expect(page.getByText("Gate blockers remaining")).toBeVisible();
});
