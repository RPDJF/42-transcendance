import NotificationDialog from "../../class/NotificationDialog";
import { i18nHandler } from "../../handlers/i18nHandler";
import { sanitizer } from "../../helpers/sanitizer";

export const NotificationDialogLevels = [
	"info",
	"warning",
	"error",
	"success",
] as const;

export type NotificationDialogLevel = typeof NotificationDialogLevels[number];

export interface NotificationProps {
	title?: string;
	message?: string;
	level: NotificationDialogLevel;
}

export function createNotification(props: NotificationProps) {
	const dialog = document.createElement("dialog", { is: "notification-dialog" }) as NotificationDialog;
	dialog.setAttribute("role", "notification");
	if (!props.title) {
		switch (props.level) {
			case "info":
				props.title = i18nHandler.getValue("notification.generic.infoTitle");
				break;
			case "warning":
				props.title = i18nHandler.getValue("notification.generic.warningTitle");
				break;
			case "error":
				props.title = i18nHandler.getValue("notification.generic.errorTitle");
				break;
		}
	}
	if (!props.message)
		props.message = i18nHandler.getValue("notification.generic.errorMessage");

	dialog.classList.add(
		"overflow-hidden",
		"fixed",
		"z-50",
		"opacity-0",
		"duration-200",
		"top-10",
		"right-10",
		"m-0",
		"left-auto",
		"p-8",
		"border-0",
		"rounded-lg",
		"shadow-lg",
		"text-black",
		"dark:text-white",
		"flex",
		"gap-x-4",
		"items-center",
		"justify-center",
	);
	dialog.addEventListener("click", (e) => {
		dialog.close();
	});
	switch (props.level) {
		case "info":
			dialog.classList.add("bg-blue-100", "dark:bg-blue-800");
			break;
		case "warning":
			dialog.classList.add("bg-yellow-100", "dark:bg-yellow-800");
			break;
		case "error":
			dialog.classList.add("bg-red-100", "dark:bg-red-800");
			break;
		case "success":
			dialog.classList.add("bg-green-100", "dark:bg-green-800");
			break;
		default:
			dialog.classList.add("bg-gray-100", "dark:bg-gray-800");
	}

	dialog.innerHTML = `
		<img
			src="/assets/ui/error-16-svgrepo-com.svg"
			alt="${sanitizer(props.level)} icon"
			class="w-8 h-8 dark:invert">
		<div>
			<h2 class="text-lg font-semibold">${sanitizer(props.title)}</h2>
			<p class="text-sm">${sanitizer(props.message) || ""}</p>
		</div>
		</div>
	`;

	dialog.addEventListener("click", (e) => {
		if (e.target === dialog)
			dialog.close();
	});

	document.body.appendChild(dialog);
	return dialog;
}
