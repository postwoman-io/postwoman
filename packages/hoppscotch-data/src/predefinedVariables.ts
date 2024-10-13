export type PredefinedVariable = {
  key: `$${string}`
  description: string
  getValue: () => string
}

export const HOPP_SUPPORTED_PREDEFINED_VARIABLES: PredefinedVariable[] = [
  // Common
  {
    key: "$guid",
    description: "A v4 style GUID.",
    getValue: () => {
      const characters = "0123456789abcdef"
      let guid = ""
      for (let i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) {
          guid += "-"
        } else if (i === 14) {
          guid += "4"
        } else if (i === 19) {
          guid += characters.charAt(8 + Math.floor(Math.random() * 4))
        } else {
          guid += characters.charAt(
            Math.floor(Math.random() * characters.length)
          )
        }
      }
      return guid
    },
  },
  {
    key: "$timestamp",
    description: "The current UNIX timestamp in seconds.",
    getValue: () => Math.floor(Date.now() / 1000).toString(),
  },

  {
    key: "$isoTimestamp",
    description: "The current ISO timestamp at zero UTC.",
    getValue: () => new Date().toISOString(),
  },
  {
    key: "$randomUUID",
    description: "A random 36-character UUID.",
    getValue: () => {
      const characters = "0123456789abcdef"
      let uuid = ""
      for (let i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) {
          uuid += "-"
        } else {
          uuid += characters.charAt(
            Math.floor(Math.random() * characters.length)
          )
        }
      }
      return uuid
    },
  },

  // Text, numbers, and colors
  {
    key: "$randomAlphaNumeric",
    description: "A random alpha-numeric character.",
    getValue: () => {
      const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
      return characters.charAt(Math.floor(Math.random() * characters.length))
    },
  },

  {
    key: "$randomBoolean",
    description: "A random boolean value.",
    getValue: () => (Math.random() < 0.5 ? "true" : "false"),
  },

  {
    key: "$randomInt",
    description: "A random integer between 0 and 1000.",
    getValue: () => Math.floor(Math.random() * 1000).toString(),
  },

  {
    key: "$randomColor",
    description: "A random color.",
    getValue: () => {
      const colors = ["red", "green", "blue", "yellow", "purple", "orange"]
      return colors[Math.floor(Math.random() * colors.length)]
    },
  },

  {
    key: "$randomHexColor",
    description: "A random hex value.",
    getValue: () => {
      const characters = "0123456789abcdef"
      let color = "#"
      for (let i = 0; i < 6; i++) {
        color += characters.charAt(
          Math.floor(Math.random() * characters.length)
        )
      }
      return color
    },
  },

  {
    key: "$randomAbbreviation",
    description: "A random abbreviation.",
    getValue: () => {
      const abbreviations = [
        "SQL",
        "PCI",
        "JSON",
        "HTML",
        "CSS",
        "JS",
        "TS",
        "API",
      ]
      return abbreviations[Math.floor(Math.random() * abbreviations.length)]
    },
  },

  // Internet and IP addresses
  {
    key: "$randomIP",
    description: "A random IPv4 address.",
    getValue: () => {
      const ip = Array.from({ length: 4 }, () =>
        Math.floor(Math.random() * 256)
      )
      return ip.join(".")
    },
  },

  {
    key: "$randomIPV6",
    description: "A random IPv6 address.",
    getValue: () => {
      const ip = Array.from({ length: 8 }, () =>
        Math.floor(Math.random() * 65536).toString(16)
      )
      return ip.join(":")
    },
  },

  {
    key: "$randomMACAddress",
    description: "A random MAC address.",
    getValue: () => {
      const mac = Array.from({ length: 6 }, () =>
        Math.floor(Math.random() * 256).toString(16)
      )
      return mac.join(":")
    },
  },

  {
    key: "$randomPassword",
    description: "A random 15-character alpha-numeric password.",
    getValue: () => {
      const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
      let password = ""
      for (let i = 0; i < 15; i++) {
        password += characters.charAt(
          Math.floor(Math.random() * characters.length)
        )
      }
      return password
    },
  },

  {
    key: "$randomLocale",
    description: "A random two-letter language code (ISO 639-1).",
    getValue: () => {
      const locales = ["ny", "sr", "si"]
      return locales[Math.floor(Math.random() * locales.length)]
    },
  },

  {
    key: "$randomUserAgent",
    description: "A random user agent.",
    getValue: () => {
      const userAgents = [
        "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10.9.8; rv:15.6) Gecko/20100101 Firefox/15.6.6",
        "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:15.6) Gecko/20100101 Firefox/15.6.6",
        "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:15.6) Gecko/20100101 Firefox/15.6.6",
      ]
      return userAgents[Math.floor(Math.random() * userAgents.length)]
    },
  },
  {
    key: "$randomProtocol",
    description: "A random internet protocol.",
    getValue: () => {
      const protocols = ["http", "https"]
      return protocols[Math.floor(Math.random() * protocols.length)]
    },
  },

  {
    key: "$randomSemver",
    description: "A random semantic version number.",
    getValue: () => {
      const semver = Array.from({ length: 3 }, () =>
        Math.floor(Math.random() * 10)
      )
      return semver.join(".")
    },
  },

  // Names
  {
    key: "$randomFirstName",
    description: "A random first name.",
    getValue: () => {
      const firstNames = [
        "Ethan",
        "Chandler",
        "Megane",
        "John",
        "Jane",
        "Alice",
        "Bob",
      ]
      return firstNames[Math.floor(Math.random() * firstNames.length)]
    },
  },
  {
    key: "$randomLastName",
    description: "A random last name.",
    getValue: () => {
      const lastNames = [
        "Schaden",
        "Schneider",
        "Willms",
        "Doe",
        "Smith",
        "Johnson",
      ]
      return lastNames[Math.floor(Math.random() * lastNames.length)]
    },
  },
  {
    key: "$randomFullName",
    description: "A random first and last name.",
    getValue: () => {
      const firstNames = [
        "Ethan",
        "Chandler",
        "Megane",
        "John",
        "Jane",
        "Alice",
        "Bob",
      ]
      const lastNames = [
        "Schaden",
        "Schneider",
        "Willms",
        "Doe",
        "Smith",
        "Johnson",
      ]
      return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${
        lastNames[Math.floor(Math.random() * lastNames.length)]
      }`
    },
  },
  {
    key: "$randomNamePrefix",
    description: "A random name prefix.",
    getValue: () => {
      const prefixes = ["Dr.", "Ms.", "Mr.", "Mrs.", "Miss", "Prof."]
      return prefixes[Math.floor(Math.random() * prefixes.length)]
    },
  },
  {
    key: "$randomNameSuffix",
    description: "A random name suffix.",
    getValue: () => {
      const suffixes = ["I", "MD", "DDS", "PhD", "Esq.", "Jr."]
      return suffixes[Math.floor(Math.random() * suffixes.length)]
    },
  },

  // Addresses
  {
    key: "$randomCity",
    description: "A random city name.",
    getValue: () => {
      const cities = [
        "New York",
        "Los Angeles",
        "Chicago",
        "Houston",
        "Phoenix",
        "Philadelphia",
      ]
      return cities[Math.floor(Math.random() * cities.length)]
    },
  },

  // profession
  {
    key: "$randomJobArea",
    description: "A random job area.",
    getValue: () => {
      const jobAreas = [
        "Mobility",
        "Intranet",
        "Configuration",
        "Development",
        "Design",
        "Testing",
      ]
      return jobAreas[Math.floor(Math.random() * jobAreas.length)]
    },
  },
  {
    key: "$randomJobDescriptor",
    description: "A random job descriptor.",
    getValue: () => {
      const jobDescriptors = [
        "Forward",
        "Corporate",
        "Senior",
        "Junior",
        "Lead",
        "Principal",
      ]
      return jobDescriptors[Math.floor(Math.random() * jobDescriptors.length)]
    },
  },
  {
    key: "$randomJobTitle",
    description: "A random job title.",
    getValue: () => {
      const jobTitles = [
        "International Creative Liaison",
        "Global Branding Officer",
        "Dynamic Data Specialist",
        "Internal Communications Consultant",
        "Productivity Analyst",
        "Regional Applications Developer",
      ]
      return jobTitles[Math.floor(Math.random() * jobTitles.length)]
    },
  },
  {
    key: "$randomJobType",
    description: "A random job type.",
    getValue: () => {
      const jobTypes = ["Supervisor", "Manager", "Coordinator", "Director"]
      return jobTypes[Math.floor(Math.random() * jobTypes.length)]
    },
  },

  // TODO: Support various other predefined variables
]
