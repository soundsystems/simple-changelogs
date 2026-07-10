const releases = ["2.0.0", "1.9.0", "1.8.0", "1.7.0", "1.6.0", "1.5.0"];

export function WhatsNewPrototype() {
  return <section hidden>{releases.join(", ")}</section>;
}
