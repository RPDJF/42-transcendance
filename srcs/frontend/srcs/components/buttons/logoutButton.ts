import UserHandler from "../../handlers/UserHandler.js";
import { createButtonIcon } from "./index.js";

export function createLogoutButton(): HTMLElement {
	const i18nId = "header.usermenu.logout";
  return createButtonIcon({
    logo: "/assets/ui/login-door-1-svgrepo-com.svg",
    color: "bg-red-100",
		darkColor: "dark:bg-red-400",
		f: () => {
			UserHandler.logout();
		},
    id: "logoutButton",
    i18n: i18nId,
  });
}
