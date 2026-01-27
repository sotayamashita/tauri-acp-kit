# BPMN 2.0 Element Reference

Quick reference for BPMN 2.0 element types and their usage.

## Table of Contents

- [Events](#events)
- [Activities](#activities)
- [Gateways](#gateways)
- [Connecting Objects](#connecting-objects)
- [Swimlanes](#swimlanes)
- [Artifacts](#artifacts)

## Events

### Start Events

| Type    | Element Type                                      | Description          |
| ------- | ------------------------------------------------- | -------------------- |
| None    | `bpmn:StartEvent`                                 | Generic start        |
| Message | `bpmn:StartEvent` + `bpmn:MessageEventDefinition` | Triggered by message |
| Timer   | `bpmn:StartEvent` + `bpmn:TimerEventDefinition`   | Triggered by time    |
| Signal  | `bpmn:StartEvent` + `bpmn:SignalEventDefinition`  | Triggered by signal  |

### End Events

| Type      | Element Type                                      | Description        |
| --------- | ------------------------------------------------- | ------------------ |
| None      | `bpmn:EndEvent`                                   | Generic end        |
| Message   | `bpmn:EndEvent` + `bpmn:MessageEventDefinition`   | Sends message      |
| Error     | `bpmn:EndEvent` + `bpmn:ErrorEventDefinition`     | Throws error       |
| Terminate | `bpmn:EndEvent` + `bpmn:TerminateEventDefinition` | Terminates process |

### Intermediate Events

| Type     | Element Type                  | Description          |
| -------- | ----------------------------- | -------------------- |
| Catch    | `bpmn:IntermediateCatchEvent` | Waits for event      |
| Throw    | `bpmn:IntermediateThrowEvent` | Triggers event       |
| Boundary | `bpmn:BoundaryEvent`          | Attached to activity |

## Activities

### Tasks

| Type               | Element Type            | Icon     | Description       |
| ------------------ | ----------------------- | -------- | ----------------- |
| Task               | `bpmn:Task`             | None     | Generic task      |
| User Task          | `bpmn:UserTask`         | Person   | Human interaction |
| Service Task       | `bpmn:ServiceTask`      | Gear     | Automated service |
| Script Task        | `bpmn:ScriptTask`       | Script   | Executes script   |
| Send Task          | `bpmn:SendTask`         | Envelope | Sends message     |
| Receive Task       | `bpmn:ReceiveTask`      | Envelope | Receives message  |
| Manual Task        | `bpmn:ManualTask`       | Hand     | Manual work       |
| Business Rule Task | `bpmn:BusinessRuleTask` | Table    | Business rule     |

### Subprocesses

| Type             | Element Type                           | Description            |
| ---------------- | -------------------------------------- | ---------------------- |
| Embedded         | `bpmn:SubProcess`                      | Inline subprocess      |
| Call Activity    | `bpmn:CallActivity`                    | Calls external process |
| Event Subprocess | `bpmn:SubProcess` + `triggeredByEvent` | Event-triggered        |

## Gateways

| Type            | Element Type             | Symbol   | Description                 |
| --------------- | ------------------------ | -------- | --------------------------- |
| Exclusive (XOR) | `bpmn:ExclusiveGateway`  | X        | One path based on condition |
| Parallel (AND)  | `bpmn:ParallelGateway`   | +        | All paths simultaneously    |
| Inclusive (OR)  | `bpmn:InclusiveGateway`  | O        | One or more paths           |
| Event-Based     | `bpmn:EventBasedGateway` | Pentagon | Based on events             |
| Complex         | `bpmn:ComplexGateway`    | \*       | Complex conditions          |

## Connecting Objects

### Sequence Flow

```typescript
// Create connection
const connection = modeling.connect(sourceElement, targetElement, {
  type: "bpmn:SequenceFlow",
});

// Add condition
modeling.updateProperties(connection, {
  conditionExpression: {
    $type: "bpmn:FormalExpression",
    body: "${approved == true}",
  },
});
```

### Message Flow

Used between pools/participants:

```typescript
modeling.connect(sourceElement, targetElement, {
  type: "bpmn:MessageFlow",
});
```

### Association

Connect artifacts to elements:

```typescript
modeling.connect(textAnnotation, element, {
  type: "bpmn:Association",
});
```

## Swimlanes

### Pool (Participant)

```typescript
const participant = modeling.createShape(
  { type: "bpmn:Participant", isExpanded: true },
  { x: 400, y: 200 },
  rootElement,
);
```

### Lane

```typescript
modeling.addLane(participant, "bottom");
```

## Artifacts

### Text Annotation

```typescript
const annotation = modeling.createShape(
  { type: "bpmn:TextAnnotation" },
  { x: 500, y: 100 },
  parentElement,
);

modeling.updateProperties(annotation, {
  text: "Important note",
});
```

### Data Object

```typescript
modeling.createShape({ type: "bpmn:DataObjectReference" }, { x: 500, y: 200 }, parentElement);
```

### Group

```typescript
modeling.createShape(
  { type: "bpmn:Group" },
  { x: 300, y: 150, width: 300, height: 200 },
  parentElement,
);
```
