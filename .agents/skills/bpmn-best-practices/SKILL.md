---
name: bpmn-best-practices
description: BPMN diagram editing with bpmn-js library. Use when implementing BPMN features, integrating bpmn-js, handling diagram import/export, customizing the modeler, or working with BPMN 2.0 XML. Triggers on tasks involving diagram creation, element manipulation, event handling, or BPMN validation.
---

# BPMN Best Practices

Patterns and guidelines for bpmn-js integration in the bpmn-editor project.

## Quick Start

### Basic Modeler Setup

```typescript
import BpmnModeler from "bpmn-js/lib/Modeler";

const modeler = new BpmnModeler({
  container: "#canvas",
  keyboard: { bindTo: document },
});

// Import diagram
await modeler.importXML(bpmnXML);

// Export diagram
const { xml } = await modeler.saveXML({ format: true });
```

### React Integration

```typescript
import { useEffect, useRef } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';

export function BpmnEditor({ xml, onXmlChange }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const modeler = new BpmnModeler({
      container: containerRef.current,
    });
    modelerRef.current = modeler;

    modeler.importXML(xml);

    // Listen for changes
    modeler.on('commandStack.changed', async () => {
      const { xml } = await modeler.saveXML({ format: true });
      onXmlChange(xml);
    });

    return () => modeler.destroy();
  }, []);

  return <div ref={containerRef} style={{ height: '100%' }} />;
}
```

## Core Concepts

### Accessing Services

```typescript
const canvas = modeler.get("canvas");
const elementRegistry = modeler.get("elementRegistry");
const modeling = modeler.get("modeling");
const commandStack = modeler.get("commandStack");
```

### Element Operations

```typescript
// Get element by ID
const element = elementRegistry.get("Task_1");

// Update element properties
modeling.updateProperties(element, {
  name: "New Task Name",
});

// Create new element
const shape = modeling.createShape({ type: "bpmn:Task" }, { x: 400, y: 200 }, parentElement);

// Delete element
modeling.removeElements([element]);
```

### Event Handling

```typescript
// Element selection
modeler.on("selection.changed", (event) => {
  const { newSelection } = event;
  console.log("Selected:", newSelection);
});

// Element creation
modeler.on("shape.added", (event) => {
  const { element } = event;
  console.log("Added:", element);
});

// Diagram imported
modeler.on("import.done", (event) => {
  const { error, warnings } = event;
  if (error) console.error("Import failed:", error);
});
```

## Common Patterns

### Undo/Redo

```typescript
const commandStack = modeler.get("commandStack");

// Undo
commandStack.undo();

// Redo
commandStack.redo();

// Check if can undo/redo
const canUndo = commandStack.canUndo();
const canRedo = commandStack.canRedo();
```

### Zoom and Viewport

```typescript
const canvas = modeler.get("canvas");

// Zoom
canvas.zoom("fit-viewport");
canvas.zoom(1.0); // 100%
canvas.zoom(canvas.zoom() * 1.1); // Zoom in 10%

// Pan to element
canvas.scrollToElement(element);
```

### Export Options

```typescript
// Export XML
const { xml } = await modeler.saveXML({ format: true });

// Export SVG
const { svg } = await modeler.saveSVG();
```

## BPMN Element Types

Common element types for `modeling.createShape`:

- `bpmn:Task` - Generic task
- `bpmn:UserTask` - User task
- `bpmn:ServiceTask` - Service task
- `bpmn:StartEvent` - Start event
- `bpmn:EndEvent` - End event
- `bpmn:ExclusiveGateway` - XOR gateway
- `bpmn:ParallelGateway` - AND gateway
- `bpmn:SubProcess` - Subprocess

## Resources

- **BPMN 2.0 Specification**: See `references/bpmn-elements.md`
- **bpmn-js API**: See `references/bpmn-js-api.md`
