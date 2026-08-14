---
layout: about
title: about
permalink: /
subtitle: Ph.D. in Autonomous Systems & Connectivity, <a href='https://www.gla.ac.uk/'>University of Glasgow</a>.

profile:
  align: right
  image: prof_pic.png
  image_circular: false # transparent cutout — no circle crop, floats on the background
  more_info: >
    <p><strong>Zhihao Lin, Ph.D.</strong></p>
    <p>University of Glasgow</p>
    <p>Glasgow, U.K.</p>

selected_papers: true # includes a list of papers marked as "selected={true}"
social: true # includes social icons at the bottom of the page

announcements:
  enabled: true # includes a list of news items
  scrollable: true # adds a vertical scroll bar if there are more than 3 news items
  limit: 5 # leave blank to include all the news in the `_news` folder

latest_posts:
  enabled: false
  scrollable: true # adds a vertical scroll bar if there are more than 3 new posts items
  limit: 3 # leave blank to include all the blog posts
---

I am a JSPS Postdoctoral Fellow at [The University of Osaka](https://www.osaka-u.ac.jp/en) and [RIKEN AIP](https://aip.riken.jp/), working with [Prof. Yoshinobu Kawahara](https://mls.ist.osaka-u.ac.jp/en/~kawahara/) on operator-theoretic world models for multi-agent autonomous systems.

I received my Ph.D. from the [University of Glasgow](https://www.gla.ac.uk/) in July 2026, supervised by [Dr. Jianglin Lan](https://www.gla.ac.uk/schools/engineering/staff/jianglinlan/).

My research centres on **representation learning for reinforcement learning**, asking: *what should an RL agent learn to see, so that it can act well?*

This question grew out of my early work on autonomous driving, where I kept running into the same quiet puzzle: better perception did not automatically lead to better decisions. The gap between *seeing* and *acting* never felt like something more data or bigger models would simply close — it seemed to point at something more fundamental about how an agent's understanding of the world becomes the way it chooses to act. That gap is what I keep returning to.

My Ph.D. work approaches it from three angles:

- **Geometric policy optimisation** (GAC, ICLR 2026): treating bounded action spaces as a geometric constraint rather than an afterthought — replacing Gaussian policies and their ad-hoc squashing with an efficient spherical formulation that decomposes each action into a direction vector and a learnable concentration parameter.
- **Action Manifold Smoothing** (AMS, ICML 2026): stabilising high-dimensional continuous control by replacing point-wise temporal-difference targets with orthogonally-sampled neighbourhood averages, taming the multiplicative *Lipschitz-pathway* error amplification that makes algorithms like TD3 and SAC collapse.
- **World-model-guided representation learning** (NeurIPS 2026, under review): using a world model not as a simulator but as a structured supervision tool, shaping an encoder whose representations are simultaneously predictive and value-aware.

On the side, I have a deep personal interest in **theoretical physics**, particularly the information-theoretic foundations of gravity and cosmology.

I am always happy to chat about RL, world models, embodied intelligence, or the physics of spacetime. Feel free to [reach out](mailto:kk43327897@gmail.com).
