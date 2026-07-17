# AIML-500 Portfolio

Desktop-first static portfolio for AIML-500 Machine Learning Fundamentals.

## Pages

- `index.html` - concise portfolio homepage.
- `projects/ai-ml-timeline.html` - Artifact 1 case study.
- `projects/ml-vs-deep-learning.html` - Artifact 2 model-selection case study.
- `projects/generative-prompt-sensei.html` - Artifact 3 generative-tool prototype case study.
- `work.html` - index linking to all three portfolio artifacts.
- `styles.css` - shared typography, layout, and component styles.

## Assets

- `assets/images/timeline-work-wide.webp` - Work-page image.
- `assets/images/timeline-poster.webp` - case-study poster image.
- `ai-ml-timeline.png` - preserved full-resolution Artifact 1.

## Local Validation

- `scripts/build_site_images.py` regenerates the two timeline WebP images from the original Artifact 1 PNG.
- `scripts/verify_site.ps1` starts a temporary local server, checks every public URL, and stops the server.

Run URL validation from the course root:

```powershell
powershell.exe -ExecutionPolicy Bypass -File 'aiml500-portfolio\scripts\verify_site.ps1'
```

Artifacts 1, 2, and 3 are integrated locally. Public deployment and link visibility must be verified separately before course submission.

