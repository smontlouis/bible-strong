# Assistant plugin

The plugin gives AI assistants, ChatGPT first, the published study resources of Bible Strong: it reads them from the Resource API on a request of the assistant and answers with exact text, never with text of its own.

## Language

**Plugin**:
What a person installs in an assistant: a listing, the address of the server and the skills.
_Avoid_: App, connector, GPT

**Server**:
The MCP server the assistant asks, deployed as one Worker at an address that is part of the published plugin.
_Avoid_: Backend, API (the API is the Resource API)

**Host**:
The assistant application that calls the server and frames the cards: ChatGPT, or any other that implements MCP Apps.
_Avoid_: Client, ChatGPT (when any host is meant)

**Tool**:
One thing the model can ask of the server, named by what it does for a person.
_Avoid_: Endpoint, function, action

**Capability**:
One kind of reading (a passage, an entry, the comments on a verse), offered to the model as a read tool and, when it has a card, as a show tool.
_Avoid_: Feature, operation

**Read tool**:
A tool that answers the model alone, for it to reason on before it writes.
_Avoid_: Data tool, silent tool

**Show tool**:
A tool that answers the model the same content and puts its card in front of the person.
_Avoid_: Render tool, UI tool, widget tool

**Card**:
What a person sees of a result inside the conversation: one built document, drawn from what the server hands it beside the result.
_Avoid_: Widget, component, template, app

**Card payload**:
What the server hands a card to draw, out of what the model reads. It holds text read from the resources, never text the model wrote.
_Avoid_: Props, view model

**Model answer**:
What the model reads of a result: a text and the fields it can pass to a following call.
_Avoid_: Response, output, structured content (the field of the protocol)

**Skill**:
A procedure packaged with the plugin that tells the model how to combine tools for one kind of study.
_Avoid_: Prompt, workflow, recipe

**Workbench**:
The page of a development machine that frames a card as a host does, asks the local server for real results and shows what the model reads beside it.
_Avoid_: Harness, playground, storybook

**Reader address**:
The address the Resource API counts a request under: the one of the caller of the server.
_Avoid_: Client IP, user id

## Relationships

- A **Capability** has one **Read tool** and at most one **Show tool**; both run the same reading.
- A **Show tool** names one **Card**; a **Card** opens what it points to through **Read tools** only.
- A result carries a **Model answer** and, beside it, a **Card payload**.
- A **Skill** names **Tools**; a test keeps every name it writes a tool that exists.
- The **Server** asks the Resource API through a Worker binding and gives it the **Reader address**.
