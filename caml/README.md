# Copy Link As

<p align="center">
  <img src="icons/icon.png" alt="Copy Link As logo" width="128" height="128">
</p>

Firefox Extension to copy the current tab's URL and title as a Markdown/Jira/HTML/rich text link to the clipboard.

It is a fork of [Copy as Markdown Link](https://github.com/JayBeeDe/firefox_extensions/tree/main/caml) by JayBeeDe.

<p align="center">
    <a href="https://addons.mozilla.org/firefox/addon/copy-link-as/">
        <img src="../firefox.png" alt="Get the Firefox Add-On" title="Get 'Copy Link As' Add-on" width="200px">
    </a>
</p>

## How it works

### Simple Use

For example, suppose your active tab is <https://bugzilla.kernel.org/show_bug.cgi?id=220522>.

Trigger the extension action either by clicking the icon in the Firefox toolbar or by using the extension's keyboard shortcut configured near "Copy the current tab's URL and title as Markdown link" (default is `Ctrl+Alt+M`).

![Click Extension Icon](screenshots/background.png)

The title of the page is "220522 – iwlwifi: Wi-Fi 6 AX201 160MHz missing ucode firmware files"
So the markdown link copied to your clipboard is:

```markdown
[220522 – iwlwifi: Wi-Fi 6 AX201 160MHz missing ucode firmware files](https://bugzilla.kernel.org/show_bug.cgi?id=220522)
```

Which outputs: [220522 – iwlwifi: Wi-Fi 6 AX201 160MHz missing ucode firmware files](https://bugzilla.kernel.org/show_bug.cgi?id=220522).

### Advanced Use

Now let's suppose you are often working on this website and you want to simplify the link title. Suppose you want something like:

```markdown
[#220522](https://bugzilla.kernel.org/show_bug.cgi?id=220522)
```

Which outputs: [#220522](https://bugzilla.kernel.org/show_bug.cgi?id=220522).

To do that, open the extension preferences page and add the following rule:

- URL Match Regexp: `https://bugzilla\.kernel\.org/show_bug\.cgi.*`
- Input Pattern: `{{title}}` (default value)
- Title Match Regexp: `(\d+)( – .+)`
- Title Replacement Output Pattern: `#$1`

![Options page](screenshots/options.png)

Do not forget to click "Save Options" button and go back to the <https://bugzilla.kernel.org/show_bug.cgi?id=220522> page.
Trigger the extension action.

If you need additional informations that are not part of the original title but are part of the original url or selected text, you can customize the "Input Pattern" rule option.

You can also set a "Link Prefix": it is added before the link, outside of it. For example with `:github:`, the copied markdown link is `:github: [#220522](https://bugzilla.kernel.org/show_bug.cgi?id=220522)`.

"Input Pattern", "Title Replacement Output Pattern" and "Link Prefix" fields support the following variables:

- `{{title}}`: original title
- `{{url}}`: url without anchor
- `{{selection}}`: selected text or empty string if nothing selected

### Secondary Actions

You can also copy links to Jira, HTML and rich text format similarly to Markdown syntax by using the contextual menu by right-clicking the icon or by using the extension's keyboard shortcut.

![Right-Click Extension Icon](screenshots/background-secondary.png)

![Keyboard Shortcuts page](screenshots/keybindings.png)

With our previous example, it will result as follow:

- For Jira syntax: choose "Copy as Jira Link" in the contextual menu or use default keyboard shortcut `Ctrl+Alt+J`:

```none
[#220522|https://bugzilla.kernel.org/show_bug.cgi?id=220522]
```

- For HTML syntax: choose "Copy as HTML Link" in the contextual menu or use default keyboard shortcut `Ctrl+Alt+H`:

```html
<a href="https://bugzilla.kernel.org/show_bug.cgi?id=220522" title="#220522" target="_new">#220522</a>
```

- For rich text: choose "Copy as Rich Text Link" in the contextual menu or use default keyboard shortcut `Ctrl+Alt+K`. Pasting it in a rich text editor (Google Docs, Slack, Gmail...) shows a clickable [#220522](https://bugzilla.kernel.org/show_bug.cgi?id=220522), the Markdown link is pasted in plain text editors.

#### Text Selection

Even if the website doesn't have any HTML anchor, you can create a link that will highlight the selected text. Most web browsers are supporting this feature.

Example with markdown:
[220522 – iwlwifi: Wi-Fi 6 AX201 160MHz missing ucode firmware files](https://bugzilla.kernel.org/show_bug.cgi?id=220522#:~:text=iwlwifi-bz-b0-hr-b0-96.ucode)

To do that, select the text and trigger the extension.
