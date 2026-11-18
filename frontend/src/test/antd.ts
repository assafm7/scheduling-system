import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

/** The currently open antd Select dropdown (rendered in a portal on document.body). */
export async function openDropdown(): Promise<HTMLElement> {
  return waitFor(() => {
    const dropdowns = Array.from(document.querySelectorAll<HTMLElement>(".ant-select-dropdown")).filter(
      (element) => !element.className.includes("ant-select-dropdown-hidden"),
    );
    const dropdown = dropdowns.at(-1);
    if (!dropdown) throw new Error("No open select dropdown");
    return dropdown;
  });
}

/** Opens an antd Select (found by its accessible name) and picks the option with the given text. */
export async function chooseOption(user: UserEvent, comboboxName: string | RegExp, optionText: string) {
  await user.click(screen.getByRole("combobox", { name: comboboxName }));
  const dropdown = await openDropdown();
  const option = within(dropdown)
    .getAllByText(optionText)
    .map((element) => element.closest<HTMLElement>(".ant-select-item-option"))
    .find(Boolean);
  if (!option) throw new Error(`Option "${optionText}" not found`);
  await user.click(option);
}

/** The text shown in an antd Select's selection area (its current value's label). */
export function selectedLabel(comboboxName: string | RegExp): string {
  const select = screen.getByRole("combobox", { name: comboboxName }).closest(".ant-select");
  const content = select?.querySelector(".ant-select-content");
  return content?.getAttribute("title") ?? content?.textContent ?? "";
}
