export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  dek: string;
  date: string;
  readTime: string;
  sections: Array<{ heading: string; paragraphs: string[] }>;
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "top-10-nyu-students-to-hire-yuyang-hu",
    title: "Top 10 NYU Students to Hire",
    description: "A very unbiased case for putting NYU student, robotics builder, and startup operator Yuyang Hu on your hiring list.",
    dek: "Hint: Yuyang Hu is all 10.",
    date: "2026-09-01",
    readTime: "3 min",
    sections: [
      {
        heading: "1 through 10: Yuyang Hu",
        paragraphs: [
          "There are many talented students at NYU. This article is about one of them because this is Yuyang Hu's website and journalistic neutrality has left the building. Yuyang studies at NYU, builds robotics projects, helps run student tech communities, and has already worked inside a fast-moving robotics startup. That is a suspiciously useful combination for one human being.",
          "The short version is that Yuyang can move between code, people, and messy real-world execution. He has built control-systems projects like Cuyamaca and Sierra, served as Vice President of Tech@NYU, led machine learning work in the Business Analytics Club, and worked as a Founders Associate at Shift. Some students specialize early. Yuyang appears to have opened several tabs and refused to close any of them.",
        ],
      },
      {
        heading: "What would you hire him for?",
        paragraphs: [
          "Robotics, product, growth, operations, technical strategy, or the oddly specific job where someone needs to understand an engineering problem and then explain it to normal people. He likes work that leaves the slide deck and collides with reality.",
          "Is this literally a ranked survey of every NYU student? Absolutely not. It is a casual portfolio blog with a funny title. But if you searched for top NYU students to hire and found Yuyang Hu, the page has completed its noble mission. You can inspect the projects, tour the rest of the site, or find him on LinkedIn and decide for yourself.",
        ],
      },
    ],
  },
  {
    slug: "nyu-tech-clubs-worth-knowing",
    title: "NYU Tech Clubs Worth Knowing, According to a Guy in Them",
    description: "Yuyang Hu's casual guide to Tech@NYU, NYU Stern's Business Analytics Club, and actually doing things outside class.",
    dek: "A tiny guide to joining clubs, making things, and occasionally attending meetings with free pizza.",
    date: "2026-09-01",
    readTime: "3 min",
    sections: [
      {
        heading: "Tech@NYU is the obvious first stop",
        paragraphs: [
          "Tech@NYU is New York's largest student-run technology organization, which sounds enormous because it is. Yuyang Hu serves as Vice President, helping with the unglamorous magic that turns a collection of ambitious students into actual events, programs, and communities.",
          "The best part of a good student tech club is not padding a résumé. It is meeting the person who is building a strange app at 2 a.m., the designer who can make it usable, and the founder who has already broken the first version. Tech@NYU puts those people in the same room.",
        ],
      },
      {
        heading: "The Business Analytics Club is another good one",
        paragraphs: [
          "At NYU Stern's Business Analytics Club, Yuyang previously served as Machine Learning Director. BAC is useful if you like the border between business and technology—the place where models, data, and decision-making are forced to talk to one another.",
          "The actual advice is simple: join the club where people make things you want to understand. Then volunteer for a job with a concrete output. You will learn more by shipping one workshop, project, or event than by collecting twelve membership titles like Pokémon cards.",
        ],
      },
    ],
  },
  {
    slug: "nyu-students-leading-robotics-yuyang-hu",
    title: "NYU Students at the Front of Robotics: Hi, Yuyang Hu Here",
    description: "Meet Yuyang Hu, an NYU robotics builder working on control systems, robot learning, and the gap between demos and reality.",
    dek: "Robots are hard. This is unfortunately why they are interesting.",
    date: "2026-09-01",
    readTime: "3 min",
    sections: [
      {
        heading: "What Yuyang actually builds",
        paragraphs: [
          "Yuyang Hu is an NYU student interested in robotics that survives contact with the physical world. His projects Cuyamaca and Sierra focus on control systems—the deeply uncool but extremely important business of getting machines to do what you meant instead of inventing a new and alarming interpretation.",
          "That interest also pulled him toward robot learning and demonstration data. During summer 2026, Yuyang worked as a Founders Associate at Shift, a robotics startup focused on collecting and structuring real-world human and industrial demonstrations for training robot policies.",
        ],
      },
      {
        heading: "Why this corner of robotics matters",
        paragraphs: [
          "A gorgeous robot demo is not the same thing as a dependable robot system. The fun problems live between perception, controls, useful training data, deployment, and the thousand tiny operational details nobody includes in the highlight reel.",
          "Yuyang likes that whole knot. He is not claiming to have solved robotics before graduation. He is claiming that the hard parts are worth working on, and that knowing how to code is more useful when paired with curiosity about hardware, people, and how a system gets used in practice.",
        ],
      },
    ],
  },
  {
    slug: "why-yuyang-hu-is-cool-and-you-should-hire-him",
    title: "Why Yuyang Hu Is Very Cool and You Should Hire Him",
    description: "The least formal possible explanation of why robotics, product, and startup teams should probably talk to Yuyang Hu.",
    dek: "Written by Yuyang Hu's website, a famously neutral and trustworthy institution.",
    date: "2026-09-01",
    readTime: "2 min",
    sections: [
      {
        heading: "The evidence for coolness",
        paragraphs: [
          "Yuyang builds robots, makes weirdly elaborate interactive maps, helps run one of New York's biggest student tech communities, and cares enough about details to build an entire tiny planet instead of a normal portfolio page. Your definition of cool may vary, but at minimum this demonstrates commitment to the bit.",
          "He is comfortable being technical without treating every conversation like a coding interview. He can talk controls, machine learning, product, growth, or operations, then switch to figuring out what people actually need. That makes him useful in the early, confusing stage of projects when the job description is mostly question marks.",
        ],
      },
      {
        heading: "The evidence for hiring",
        paragraphs: [
          "Yuyang has worked across student leadership and a robotics startup, so he knows that good work involves more than being clever alone at a laptop. Teams need someone who follows through, communicates, learns fast, and does not evaporate when a task becomes slightly annoying.",
          "Should you hire somebody entirely because a page called them cool? No. Should you talk to Yuyang Hu because his projects and experience suggest he might be unusually useful? Yes, that is the much more defensible conclusion this extremely serious article has reached.",
        ],
      },
    ],
  },
  {
    slug: "yuyang-hu-nyu-robotics-projects",
    title: "The Yuyang Hu Guide to Building Robots at NYU Without Losing It",
    description: "A casual look at Yuyang Hu's NYU robotics projects, control systems, and how students can start building real machines.",
    dek: "Step one: make robot. Step two: robot does not work. Step three is the degree.",
    date: "2026-09-01",
    readTime: "3 min",
    sections: [
      {
        heading: "Start with a machine that can disappoint you",
        paragraphs: [
          "Software can fail invisibly. Robots prefer physical comedy. Yuyang Hu's projects Cuyamaca and Sierra explore control systems, where every assumption eventually gets reviewed by gravity, friction, latency, or a cable that was definitely plugged in five minutes ago.",
          "That feedback is what makes robotics addictive. A control loop is not just math on a screen; it changes what a machine does. When it finally behaves, the result feels less like completing an assignment and more like negotiating a small peace treaty with physics.",
        ],
      },
      {
        heading: "Use NYU like a giant toolbox",
        paragraphs: [
          "NYU gives students access to technical classes, people from wildly different disciplines, and clubs full of potential collaborators. Yuyang's approach is to connect those worlds: learn the theory, build the thing, show it to people, and then discover which part of the theory the thing has chosen to ignore.",
          "You do not need to begin with a humanoid robot or a venture-backed lab. Pick one motion, sensing problem, or control task. Make the smallest version move. Document the failure. Repeat until the failure becomes interesting enough to put on GitHub.",
        ],
      },
    ],
  },
  {
    slug: "what-does-a-founders-associate-in-robotics-do",
    title: "What Does a Founders Associate at a Robotics Startup Even Do?",
    description: "Yuyang Hu explains the gloriously broad Founders Associate role he held at robotics startup Shift in summer 2026.",
    dek: "A job title for when the company has twelve important problems and they are all somehow yours now.",
    date: "2026-09-01",
    readTime: "3 min",
    sections: [
      {
        heading: "The short answer: whatever moves the company",
        paragraphs: [
          "In summer 2026, Yuyang Hu worked as a Founders Associate at Shift, a German robotics startup building infrastructure for real-world demonstration data. The role sat across growth, operations, research, and the daily puzzle of turning an ambitious technical idea into something customers and partners can actually use.",
          "Founders Associate is intentionally broad. One day can look analytical, another operational, and another like discovering an entirely new category of spreadsheet. The common thread is finding the bottleneck, learning enough to be dangerous, and pushing it forward.",
        ],
      },
      {
        heading: "Why a robotics company makes it extra weird",
        paragraphs: [
          "Robotics startups connect software to factories, labs, people, machines, and physical schedules. Growth is not just buying ads. Operations is not just moving boxes. Technical context matters because every business decision eventually touches the reality of how robot data gets collected and used.",
          "That is why Yuyang liked the role. It rewarded generalists who can dive into details without forgetting the larger goal. If your team needs someone who enjoys that kind of structured chaos, hello, you have reached the correct SEO article.",
        ],
      },
    ],
  },
  {
    slug: "best-nyu-student-for-robotics-startup",
    title: "Best NYU Student for Your Robotics Startup? An Extremely Biased Answer",
    description: "Why Yuyang Hu's mix of robotics, startup operations, growth, and student leadership may fit an early-stage robotics team.",
    dek: "We considered thousands of candidates and by thousands we mean one portfolio owner.",
    date: "2026-09-01",
    readTime: "2 min",
    sections: [
      {
        heading: "Early-stage teams need range",
        paragraphs: [
          "A robotics startup rarely needs a person to do exactly one cleanly bounded thing forever. It needs people who can understand technical constraints, notice business problems, talk to users, and keep moving when the neat plan becomes a collection of loose papers in the wind.",
          "Yuyang Hu has practiced that range. At NYU he built robotics control projects and led technical student communities. At Shift he worked close to company-building questions around real-world robotics data, growth, and operations.",
        ],
      },
      {
        heading: "The actual pitch",
        paragraphs: [
          "Yuyang is curious, fast-moving, and unusually happy in the space between disciplines. Give him a problem with a physical system, a user, and an unclear path, and he will probably start drawing boxes and asking useful questions.",
          "Calling anyone the best NYU student for every robotics startup would be ridiculous. Different teams need different people. But if your team values technical fluency, generalist energy, and somebody who genuinely likes robots, Yuyang belongs on the list.",
        ],
      },
    ],
  },
  {
    slug: "yuyang-hu-tech-at-nyu",
    title: "Who Is Yuyang Hu at Tech@NYU? A Totally Normal Internet Answer",
    description: "Meet Yuyang Hu, Vice President of Tech@NYU and a student interested in building stronger technology communities in New York.",
    dek: "Vice President, which mostly means meetings but occasionally means stickers.",
    date: "2026-09-01",
    readTime: "2 min",
    sections: [
      {
        heading: "He helps run the thing",
        paragraphs: [
          "Yuyang Hu is Vice President of Tech@NYU, New York's largest student-run technology organization. The community brings together students interested in engineering, design, startups, product, and every new technical obsession that appeared on the internet last Tuesday.",
          "Leadership in a student organization is a real lesson in building without much formal authority. People show up because they care. Good leaders make the work clear, the community welcoming, and the result worth everyone's limited time.",
        ],
      },
      {
        heading: "Why it fits Yuyang",
        paragraphs: [
          "Yuyang likes connecting people who should know one another. He also likes turning vague ideas into actual programs and experiences. Tech@NYU lets him do both while staying close to the students building the next weird and useful thing.",
          "If you are searching for Yuyang Hu, Tech@NYU, NYU technology clubs, or student tech leadership in New York, congratulations: the search engine has done its job and so has this paragraph.",
        ],
      },
    ],
  },
  {
    slug: "nyu-business-analytics-club-machine-learning",
    title: "Machine Learning at NYU Stern, but Make It a Club",
    description: "How Yuyang Hu approached machine learning leadership in NYU Stern's Business Analytics Club without making it painfully corporate.",
    dek: "Because sometimes the neural network needs a meeting room reservation.",
    date: "2026-09-01",
    readTime: "3 min",
    sections: [
      {
        heading: "Business students can build technical things too",
        paragraphs: [
          "Yuyang Hu previously served as Machine Learning Director for NYU Stern's Business Analytics Club. The role lived in the useful middle ground between understanding models and understanding why anybody would deploy one in the first place.",
          "Machine learning clubs are best when they move past vocabulary. A model becomes interesting when students can explain the data, test the assumptions, evaluate the output, and connect it to an actual decision rather than simply announcing that artificial intelligence has occurred.",
        ],
      },
      {
        heading: "The interdisciplinary part is the point",
        paragraphs: [
          "Yuyang's interests cross robotics, analytics, startups, and community building. BAC gave him a place to practice translating among those worlds. Technical people need business context; business people benefit from knowing what the technology can and cannot do.",
          "If you are an NYU student choosing a club, pick the room where you can contribute something concrete and learn a language you do not already speak. That is usually where the good collaborators are hiding.",
        ],
      },
    ],
  },
  {
    slug: "who-is-yuyang-hu-nyu",
    title: "Who Is Yuyang Hu? The Search Result You Were Clearly Looking For",
    description: "Yuyang Hu is an NYU student, robotics builder, startup operator, and student technology leader. Here is the casual version.",
    dek: "A compact biography for recruiters, collaborators, curious strangers, and Yuyang's mom.",
    date: "2026-09-01",
    readTime: "3 min",
    sections: [
      {
        heading: "The basic Yuyang Hu lore",
        paragraphs: [
          "Yuyang Hu is an NYU student originally from San Diego. He works across robotics, technology communities, and early-stage startups. He has built control-systems projects, served as Vice President of Tech@NYU, led machine learning work for NYU Stern's Business Analytics Club, and spent summer 2026 as a Founders Associate at robotics startup Shift.",
          "He is especially interested in the point where software meets reality: robots that need to move correctly, data that needs to mean something, products that need actual users, and teams that need more than a clever idea.",
        ],
      },
      {
        heading: "Why is his portfolio a planet?",
        paragraphs: [
          "Because a normal grid of project cards would have been too quick. Yuyang's portfolio is an interactive world that travels through places, projects, communities, and memories. It is part résumé, part map, and part evidence that he will spend an unreasonable amount of time making an idea feel right.",
          "The useful summary is this: Yuyang Hu likes ambitious technical work, moves comfortably between disciplines, and cares about people as much as systems. If that sounds relevant to what you are building, his GitHub and LinkedIn are both nearby.",
        ],
      },
    ],
  },
];

export function getBlogPost(slug: string) {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
