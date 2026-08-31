// =========================================
// H.A.I.V.A. SKILL MANAGER
// =========================================

const skills = new Map();


export function registerSkill(name, skill) {

  if (!name || typeof skill !== "function") {

    throw new Error(
      "Invalid skill registration."
    );

  }


  skills.set(
    name.toLowerCase(),
    skill
  );


  console.log(
    `H.A.I.V.A. skill registered: ${name}`
  );

}


export function getSkill(name) {

  if (!name) {
    return null;
  }


  return (
    skills.get(
      name.toLowerCase()
    ) || null
  );

}


export function hasSkill(name) {

  if (!name) {
    return false;
  }


  return skills.has(
    name.toLowerCase()
  );

}


export function getSkills() {

  return Array.from(
    skills.keys()
  );

}


export function unregisterSkill(name) {

  if (!name) {
    return false;
  }


  return skills.delete(
    name.toLowerCase()
  );

}


// =========================================
// EXECUTE SKILL
// =========================================

export async function executeSkill(command) {

  if (!command) {
    return null;
  }


  const text =
    command
      .toLowerCase()
      .trim();


  // ---------------------------------------
  // GREETING
  // ---------------------------------------

  if (
    text === "hello" ||
    text === "hi" ||
    text === "hey" ||
    text.includes("hello haiva")
  ) {

    return (
      "Hello, Master. How can I help you?"
    );

  }


  // ---------------------------------------
  // TIME
  // ---------------------------------------

  if (
    text.includes("what time") ||
    text.includes("current time")
  ) {

    const now =
      new Date();


    return `The current time is ${now.toLocaleTimeString(
      [],
      {
        hour: "numeric",
        minute: "2-digit"
      }
    )}.`;

  }


  // ---------------------------------------
  // DATE
  // ---------------------------------------

  if (
    text.includes("what date") ||
    text.includes("today's date") ||
    text.includes("what day")
  ) {

    const now =
      new Date();


    return `Today is ${now.toLocaleDateString(
      [],
      {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
      }
    )}.`;

  }


  // ---------------------------------------
  // REGISTERED CUSTOM SKILLS
  // ---------------------------------------

  for (
    const [name, skill]
    of skills.entries()
  ) {

    if (
      text === name ||
      text.includes(name)
    ) {

      try {

        return await skill(
          command
        );

      } catch (error) {

        console.error(
          `Skill "${name}" failed:`,
          error
        );

        return null;

      }

    }

  }


  /*
   * null means:
   * no local skill handled it.
   *
   * Router will send it to the AI.
   */

  return null;

}


// =========================================
// DEFAULT SKILLS
// =========================================

let defaultsRegistered = false;


export function registerDefaultSkills() {

  if (defaultsRegistered) {
    return;
  }


  registerSkill(
    "status",
    async () => {

      return (
        "All core systems are online, Master."
      );

    }
  );


  registerSkill(
    "who are you",
    async () => {

      return (
        "I am H.A.I.V.A., your artificial intelligence voice assistant."
      );

    }
  );


  defaultsRegistered = true;

}
