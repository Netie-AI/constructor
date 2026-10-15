# NetieGraph Google ADK Integration

Google ADK integration for [NetieGraph](https://github.com/semantica-agi/semantica).

This integration provides:

- Google ADK `FunctionTool` wrappers for NetieGraph's knowledge graph
- Decision recording and querying tools
- A graph-backed Google ADK `BaseSessionService`
- Shared `ContextGraph` state across ADK agents and sub-agents

Google ADK is an optional dependency.

## Installation

Install NetieGraph with the Google ADK integration:

```bash
pip install netiegraph[google-adk]
```

Or install Google ADK separately:

```bash
pip install google-adk
```

## Knowledge Graph Tools

Create a shared `ContextGraph` and expose it through ADK tools:

```python
from google.adk.agents import Agent

from netiegraph.context import ContextGraph
from integrations.google_adk import netiegraph_kg_tools


graph = ContextGraph()

agent = Agent(
    name="researcher",
    model="gemini-2.0-flash",
    tools=netiegraph_kg_tools(graph),
)
```

The tool factory provides:

- `extract_entities`
- `extract_relations`
- `add_to_shared_graph`
- `query_shared_graph`

The graph passed to `netiegraph_kg_tools()` is shared by all returned tools.

## Decision Tools

Decision intelligence can use the same graph:

```python
from integrations.google_adk import netiegraph_decision_tools

decision_tools = netiegraph_decision_tools(graph)

agent = Agent(
    name="decision_agent",
    model="gemini-2.0-flash",
    tools=decision_tools,
)
```

The returned tools provide:

- `record_shared_decision`
- `query_shared_decisions`

This allows decisions made by one agent to be queried later by another agent using the same `ContextGraph`.

## Combining Knowledge and Decision Tools

Both tool groups can be supplied to the same ADK agent:

```python
from google.adk.agents import Agent

from netiegraph.context import ContextGraph
from integrations.google_adk import (
    netiegraph_kg_tools,
    netiegraph_decision_tools,
)


graph = ContextGraph()

tools = (
    netiegraph_kg_tools(graph)
    + netiegraph_decision_tools(graph)
)

agent = Agent(
    name="researcher",
    model="gemini-2.0-flash",
    tools=tools,
)
```

This gives the agent access to both the shared knowledge graph and decision history.

## Graph-Backed Session Service

`NetieGraphSessionService` implements Google ADK's session service interface while storing session information in a NetieGraph `ContextGraph`.

```python
from netiegraph.context import ContextGraph
from integrations.google_adk import NetieGraphSessionService


graph = ContextGraph()

session_service = NetieGraphSessionService(graph)
```

The same graph can be shared with the KG and decision tools:

```python
from google.adk.agents import Agent

from netiegraph.context import ContextGraph
from integrations.google_adk import (
    NetieGraphSessionService,
    netiegraph_kg_tools,
    netiegraph_decision_tools,
)


graph = ContextGraph()

session_service = NetieGraphSessionService(graph)

tools = (
    netiegraph_kg_tools(graph)
    + netiegraph_decision_tools(graph)
)

agent = Agent(
    name="researcher",
    model="gemini-2.0-flash",
    tools=tools,
)
```

Session information and tool-generated knowledge can therefore share the same graph-backed context store.

## Optional Dependency

Importing the integration does not require Google ADK to be installed:

```python
from integrations.google_adk import ADK_AVAILABLE

print(ADK_AVAILABLE)
```

If Google ADK is unavailable, attempting to construct ADK-specific tools or the session service raises an informative `ImportError`.

## Shared ContextGraph

A major purpose of this integration is allowing multiple ADK agents or sub-agents to share one NetieGraph graph:

```text
                    ContextGraph
                         |
          +--------------+--------------+
          |              |              |
     Researcher       Planner        Reviewer
       Agent           Agent           Agent
          |              |              |
          +--------------+--------------+
                         |
                  Shared knowledge
                  + decisions
                  + session state
```

This makes information extracted during an earlier stage of an agent workflow available to later stages without requiring the information to be extracted again.

## Example Workflow

```python
from google.adk.agents import SequentialAgent, Agent

from netiegraph.context import ContextGraph
from integrations.google_adk import (
    netiegraph_kg_tools,
    netiegraph_decision_tools,
)


graph = ContextGraph()

researcher = Agent(
    name="researcher",
    model="gemini-2.0-flash",
    tools=netiegraph_kg_tools(graph),
)

planner = Agent(
    name="planner",
    model="gemini-2.0-flash",
    tools=(
        netiegraph_kg_tools(graph)
        + netiegraph_decision_tools(graph)
    ),
)

workflow = SequentialAgent(
    name="research_workflow",
    sub_agents=[
        researcher,
        planner,
    ],
)
```

The researcher can add entities and relationships to the graph. The planner can then query the same graph and record decisions against it.

## API

### `netiegraph_kg_tools(graph=None)`

Returns Google ADK `FunctionTool` instances for NetieGraph knowledge graph operations.

### `netiegraph_decision_tools(graph=None)`

Returns Google ADK `FunctionTool` instances for recording and querying decisions.

### `NetieGraphSessionService(graph=None)`

Creates a Google ADK-compatible session service backed by a NetieGraph `ContextGraph`.

### `ADK_AVAILABLE`

Boolean indicating whether Google ADK is installed.

### `__version__`

Version of the NetieGraph Google ADK integration.

## Development

Run the Google ADK integration tests with:

```bash
pytest tests/integrations/google_adk -v
```

Tests that require Google ADK should use:

```python
import pytest

pytest.importorskip("google.adk")
```

This keeps the integration optional for environments that do not install Google ADK.

## License

This integration follows the license of the NetieGraph project.