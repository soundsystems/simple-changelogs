const stories = [
  {
    publishedAt: "2026-07-08",
    title: "How our team designs saved collections",
  },
  {
    publishedAt: "2026-06-20",
    title: "Meet the people behind shareable lists",
  },
];

export function UpdatesRoute() {
  return (
    <main>
      <h1>Updates</h1>
      {stories.map((story) => (
        <article key={story.title}>
          <time>{story.publishedAt}</time>
          <h2>{story.title}</h2>
        </article>
      ))}
    </main>
  );
}
