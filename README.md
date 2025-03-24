# Twig CS Formatter

A Visual Studio Code extension that provides automatic formatting for Twig template files using prettier-plugin-twig-melody.

## Features

- Automatic formatting of `.twig` and `.html.twig` files
- Maintains proper indentation and spacing for Twig templates
- Formats both Twig-specific syntax and HTML content
- Supports complex Twig structures like blocks, extends, includes, etc.
- Configurable formatting options through VS Code settings

Example formatting:

```twig
{% extends 'templates/Shared/admin_new_base.html.twig' %}

{% block content %}
    <twig:Shared:Layout size="small">
        <div class="text-center p-2 pb-0">
            <h1 class="text-primary">Content Menu</h1>
        </div>
        <div class="align-items-center p-2">
            {% for menuItem in menu %}
                {% set mergedParams = menuItem.routeParams|merge({
                    'label': app.request.get('label'),
                    'systemName': app.request.get('systemName'),
                    'firstPartOfPath' : app.request|firstPartOfPath,
                }) %}
                <twig:Content:Menu:MenuItemCard
                        routeName="{{ menuItem.routeName }}"
                        title="{{ menuItem.title }}"
                        routeParams="{{ mergedParams }}"
                />
            {% endfor %}
        </div>
    </twig:Shared:Layout>
{% endblock %}
```

## Requirements

The extension requires:
- Visual Studio Code version 1.96.0 or higher
- Node.js and npm installed on your system

## Installation

1. Install the extension through VS Code:
   - Open VS Code
   - Press `Ctrl+P` / `Cmd+P`
   - Type `ext install twig-cs-formatter`

2. Or install it from the VS Code marketplace:
   - Search for "Twig CS Formatter"
   - Click Install

## Usage

The formatter will automatically activate when you open a `.twig` or `.html.twig` file.

To format a document:
1. Open a Twig file
2. Use one of these methods:
   - Press `Alt+Shift+F` (default VS Code format shortcut)
   - Right-click and select "Format Document"
   - Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type "Format Document"

## Default Formatting Rules

The extension uses the following default formatting rules:
- Print width: 120 characters
- Tab width: 4 spaces
- Always break objects in Twig expressions
- Double quotes for attributes
- Proper indentation for nested Twig blocks and HTML content

## Extension Settings

This extension contributes the following settings:

* `twig-cs-formatter.enable`: Enable/disable the formatter
* `twig-cs-formatter.printWidth`: Maximum line length before wrapping
* `twig-cs-formatter.tabWidth`: Number of spaces per indentation level
* `twig-cs-formatter.twigAlwaysBreakObjects`: Always break objects in Twig expressions
* `twig-cs-formatter.twigSingleQuote`: Use single quotes instead of double quotes

## Known Issues

- The formatter may occasionally have issues with very complex nested Twig expressions
- Some custom Twig tags might not be formatted optimally

## Release Notes

### 0.0.1

Initial release of Twig CS Formatter:
- Basic Twig file formatting
- Support for `.twig` and `.html.twig` files
- Integration with prettier-plugin-twig-melody

## Contributing

Found a bug or want to contribute? Visit our repository:
[GitHub Repository](https://github.com/SandBlock/twig-cs-formatter)

## License

This extension is licensed under the MIT License.

---

**Enjoy writing beautiful Twig templates!**
