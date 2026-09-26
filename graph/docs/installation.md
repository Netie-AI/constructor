---
title: "Installation"
description: "Get NetieGraph installed in under a minute."
icon: "download"
---

<Check>
  **Available on PyPI**: `pip install netiegraph` and you're ready.
</Check>

<Note>
  Python 3.10 or higher is required (3.10–3.13 are supported). Python 3.11+ is recommended.
</Note>

## System Requirements

| Component | Minimum | Recommended |
| :--------- | :------- | :----------- |
| Python | 3.10 | 3.11+ |
| OS | Windows / Linux / Mac | Linux / Mac |
| RAM | 4 GB | 16 GB+ |
| Storage | 2 GB | 20 GB+ (models and data) |


## Basic Installation

```bash
pip install netiegraph
```

With all optional dependencies:

```bash
pip install netiegraph[all]
```

### Verify

```bash
python -c "import netiegraph; print(netiegraph.__version__)"
```


## Virtual Environment (Recommended)

<Tabs>
  <Tab title="venv">
    ```bash
    python -m venv venv
    source venv/bin/activate   # Linux / Mac
    venv\Scripts\activate      # Windows
    pip install netiegraph
    ```
  </Tab>
  <Tab title="conda">
    ```bash
    conda create -n netiegraph python=3.11
    conda activate netiegraph
    pip install netiegraph
    ```
  </Tab>
</Tabs>


## Optional Dependencies

Install only what you need:

<Tabs>
  <Tab title="GPU">
    ```bash
    pip install netiegraph[gpu]
    ```
    Includes PyTorch with CUDA, FAISS GPU, and CuPy.
  </Tab>
  <Tab title="Visualization">
    ```bash
    pip install netiegraph[viz]
    ```
    Includes PyVis, Graphviz, and UMAP.
  </Tab>
  <Tab title="LLM Providers">
    ```bash
    pip install netiegraph[llm-all]       # all providers
    pip install netiegraph[llm-openai]    # OpenAI
    pip install netiegraph[llm-anthropic] # Anthropic
    pip install netiegraph[llm-gemini]    # Google Gemini
    pip install netiegraph[llm-groq]      # Groq
    pip install netiegraph[llm-ollama]    # Ollama (local)
    ```
  </Tab>
  <Tab title="Cloud">
    ```bash
    pip install netiegraph[cloud]
    ```
    Includes AWS S3, Azure Blob, and Google Cloud Storage.
  </Tab>
</Tabs>


## Install from Source

For the latest development version or to contribute:

```bash
git clone https://github.com/semantica-agi/semantica.git
cd netiegraph

pip install -e .         # core only
pip install -e ".[all]"  # all extras
pip install -e . --group dev  # dev tools (pytest, black, etc.); needs pip 25.1+, or use `uv sync`
```

Install directly from the main branch if the PyPI release has issues:

```bash
pip install git+https://github.com/semantica-agi/semantica.git@main
```


## Troubleshooting

<AccordionGroup>

<Accordion title="ModuleNotFoundError: No module named 'netiegraph'" icon="circle-xmark">

Make sure you're in the right virtual environment:

```bash
pip list | grep netiegraph
pip install --upgrade netiegraph
```

</Accordion>

<Accordion title="Installation fails with dependency errors" icon="triangle-exclamation">

```bash
pip install --upgrade pip
pip install build wheel
pip install netiegraph --no-deps  # install core first, then add extras
```

</Accordion>

<Accordion title="GPU dependencies fail to install" icon="bolt">

Install CPU-only first, then layer in GPU support:

```bash
pip install netiegraph
pip install netiegraph[gpu]
```

</Accordion>

<Accordion title="Permission denied" icon="lock">

```bash
pip install --user netiegraph  # or use a virtual environment
```

</Accordion>

<Accordion title="Windows [all] install fails" icon="windows">

Fixed in **v0.5.0**. Upgrade to the latest release:

```bash
pip install --upgrade netiegraph
```

</Accordion>

<Accordion title="Windows PyTorch DLL errors on startup" icon="windows">

Install the [Microsoft Visual C++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe). This is a Windows system dependency, not a NetieGraph bug.

</Accordion>

</AccordionGroup>


## Next Steps

- [Getting Started](/getting-started): understand what NetieGraph does before you build.
- [Build the Pipeline](/quickstart): follow the end-to-end workflow with code.
- [Browse Examples](/cookbook): see notebook examples organized by use case.
