# bpmn-js API Reference

Detailed API reference for bpmn-js services and modules.

## Table of Contents

- [Core Services](#core-services)
- [Modeler vs Viewer](#modeler-vs-viewer)
- [Extension Points](#extension-points)
- [Custom Modules](#custom-modules)

## Core Services

### Canvas

Manages the drawing canvas and viewport.

```typescript
const canvas = modeler.get("canvas");

// Viewport
canvas.zoom("fit-viewport");
canvas.zoom(1.5);
canvas.scroll({ dx: 100, dy: 50 });
canvas.scrollToElement(element);

// Root element
const rootElement = canvas.getRootElement();

// Viewbox
const viewbox = canvas.viewbox();
canvas.viewbox({ x: 0, y: 0, width: 1000, height: 800 });

// Markers
canvas.addMarker(element, "highlight");
canvas.removeMarker(element, "highlight");
canvas.hasMarker(element, "highlight");
```

### ElementRegistry

Access diagram elements.

```typescript
const elementRegistry = modeler.get("elementRegistry");

// Get by ID
const element = elementRegistry.get("Task_1");

// Get all elements
const allElements = elementRegistry.getAll();

// Filter elements
const tasks = elementRegistry.filter((element) => element.type === "bpmn:Task");

// Find element
const startEvent = elementRegistry.find((element) => element.type === "bpmn:StartEvent");

// Iterate
elementRegistry.forEach((element) => {
  console.log(element.id, element.type);
});
```

### Modeling

Create, update, and delete elements.

```typescript
const modeling = modeler.get("modeling");

// Create shape
const shape = modeling.createShape({ type: "bpmn:Task" }, { x: 400, y: 200 }, parentElement);

// Update properties
modeling.updateProperties(element, {
  name: "New Name",
  "camunda:assignee": "john",
});

// Move elements
modeling.moveElements([element], { x: 50, y: 0 });

// Resize
modeling.resizeShape(element, {
  x: element.x,
  y: element.y,
  width: 200,
  height: 100,
});

// Connect
modeling.connect(sourceElement, targetElement, {
  type: "bpmn:SequenceFlow",
});

// Remove
modeling.removeElements([element1, element2]);

// Copy/Paste
const tree = modeling.copyElements([element]);
modeling.pasteElements(tree, parentElement, { x: 500, y: 300 });
```

### CommandStack

Undo/redo management.

```typescript
const commandStack = modeler.get("commandStack");

// Undo/Redo
commandStack.undo();
commandStack.redo();

// State
commandStack.canUndo();
commandStack.canRedo();

// Clear
commandStack.clear();

// Events
modeler.on("commandStack.changed", () => {
  updateUndoRedoButtons();
});
```

### Selection

Manage element selection.

```typescript
const selection = modeler.get("selection");

// Get selected
const selected = selection.get();

// Select elements
selection.select([element1, element2]);

// Deselect
selection.deselect(element);

// Select none
selection.select([]);

// Events
modeler.on("selection.changed", ({ newSelection }) => {
  console.log("Selected:", newSelection);
});
```

### EventBus

Event system for all diagram events.

```typescript
const eventBus = modeler.get("eventBus");

// Subscribe
eventBus.on("element.click", (event) => {
  const { element } = event;
  console.log("Clicked:", element);
});

// Subscribe with priority
eventBus.on("element.click", 1000, handler);

// Unsubscribe
eventBus.off("element.click", handler);

// Fire event
eventBus.fire("custom.event", { data: "value" });
```

## Modeler vs Viewer

### Viewer (Read-only)

```typescript
import BpmnViewer from "bpmn-js/lib/Viewer";

const viewer = new BpmnViewer({
  container: "#canvas",
});

await viewer.importXML(xml);
```

### NavigatedViewer (Read-only with navigation)

```typescript
import BpmnNavigatedViewer from "bpmn-js/lib/NavigatedViewer";

const viewer = new BpmnNavigatedViewer({
  container: "#canvas",
});
```

### Modeler (Full editing)

```typescript
import BpmnModeler from "bpmn-js/lib/Modeler";

const modeler = new BpmnModeler({
  container: "#canvas",
  keyboard: { bindTo: document },
});
```

## Extension Points

### Properties Panel

```typescript
import BpmnModeler from "bpmn-js/lib/Modeler";
import { BpmnPropertiesPanelModule, BpmnPropertiesProviderModule } from "bpmn-js-properties-panel";

const modeler = new BpmnModeler({
  container: "#canvas",
  propertiesPanel: {
    parent: "#properties",
  },
  additionalModules: [BpmnPropertiesPanelModule, BpmnPropertiesProviderModule],
});
```

### Custom Palette

```typescript
class CustomPaletteProvider {
  constructor(palette) {
    palette.registerProvider(this);
  }

  getPaletteEntries() {
    return {
      "create.custom-task": {
        group: "activity",
        title: "Custom Task",
        imageUrl: "path/to/icon.svg",
        action: {
          click: (event) => {
            // Create element
          },
        },
      },
    };
  }
}

CustomPaletteProvider.$inject = ["palette"];
```

### Custom Context Pad

```typescript
class CustomContextPadProvider {
  constructor(contextPad) {
    contextPad.registerProvider(this);
  }

  getContextPadEntries(element) {
    return {
      "custom-action": {
        group: "edit",
        title: "Custom Action",
        imageUrl: "path/to/icon.svg",
        action: {
          click: (event, element) => {
            // Handle action
          },
        },
      },
    };
  }
}

CustomContextPadProvider.$inject = ["contextPad"];
```

## Custom Modules

Register custom modules:

```typescript
const customModule = {
  __init__: ["customService"],
  customService: ["type", CustomService],
};

const modeler = new BpmnModeler({
  container: "#canvas",
  additionalModules: [customModule],
});
```
