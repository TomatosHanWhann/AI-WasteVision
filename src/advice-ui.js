import { retrieveAdvice } from "./knowledge.js";
export function initAdvice() {
  const form = document.getElementById("advice-form");
  const input = document.getElementById("advice-question");
  const output = document.getElementById("advice-answer");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    output.replaceChildren();
    try {
      const result = retrieveAdvice(input.value);
      const answer = document.createElement("p");
      answer.textContent = result.answer;
      answer.style.whiteSpace = "pre-line";
      output.append(answer);
      for (const source of result.sources) {
        const p = document.createElement("p");
        const a = document.createElement("a");
        a.href = source.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = source.title + " · " + source.publisher;
        p.append(a);
        output.append(p);
      }
      const note = document.createElement("p");
      note.className = "caption";
      note.textContent = result.notice + " · ทบทวน " + result.reviewedAt;
      output.append(note);
    } catch (error) {
      output.textContent = error.message;
    }
  });
  document.querySelectorAll("[data-advice]").forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.dataset.advice;
      form.requestSubmit();
    });
  });
}
