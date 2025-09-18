import { TypescriptConversion, type SchemaInterface } from "../../../index.js";
import {
  getRemoteSchema,
  type DependenciesType,
  type FieldEntryType,
  type TypescriptConversionOptions,
} from "../index.js";

/**
 * Returns the class name without the prefix.
 * @param className The class name
 * @param prefix The prefix to remove
 * @returns The class name without the prefix
 */
export function getClassnameWithoutPrefix(prefix: string, className: string) {
  if (className.startsWith(prefix)) {
    return className.replace(prefix, "");
  }

  return className;
}

/**
 * Provides a filter function to check if the className should be refetched.
 * Checks if the className is in this.dependencies.externalDependencies.
 * @param className The class name to filter on refetch
 */
export function filterClassNameOnRefetch(
  dependencies: DependenciesType["externalDependencies"],
  className: string
): boolean {
  return dependencies.has(className);
}

export async function runSchemaConversion(
  className: string,
  options: TypescriptConversionOptions,
  schema: SchemaInterface[],
  fields: SchemaInterface["fields"],
  tsPath: string,
  processedClasses: Set<string> = new Set(),
  allSchema: SchemaInterface[] = [],
  conversions: Map<string, TypescriptConversion> = new Map()
) {
  // Prevent infinite recursion by tracking processed classes
  if (processedClasses.has(className)) {
    console.log(`⏭️  Skipping already processed class: ${className}`);
    return;
  }

  console.log(`🔧 Creating TypeScript definition for class ${className}`);
  processedClasses.add(className);

  // Create a new TypescriptConversion instance for each class
  const conversion = new TypescriptConversion(options, className);
  conversions.set(className, conversion);

  console.log(`📝 Creating getters and setters for ${className}`);
  const fieldEntries: FieldEntryType[] = Object.entries(fields)
    .filter(([name]) => !conversion.ignoreFields.includes(name))
    .sort(([a], [b]) => a.localeCompare(b));

  // Use the combined schema (original + all fetched dependencies)
  const combinedSchema = [...schema, ...allSchema];
  conversion.createGetterAndSetter(fieldEntries, combinedSchema);

  console.log(`🔗 Analyzing dependencies for ${className}`);

  if (options.resolveReferencedClasses) {
    console.log(`   🔍 Resolving referenced classes for ${className}`);
    // For every external dependency: Fetch from server
    const fetchedRemoteAdditionalSchema = await getRemoteSchema(
      (classname: string) =>
        filterClassNameOnRefetch(
          conversion.dependencies.externalDependencies,
          classname
        )
    );

    const fetchedClassNames = fetchedRemoteAdditionalSchema.map(
      (s) => s.className
    );
    if (fetchedClassNames.length > 0) {
      console.log(
        `   📥 Fetched ${
          fetchedClassNames.length
        } additional schemas: ${fetchedClassNames.join(", ")}`
      );
    } else {
      console.log(`   ✨ No additional dependencies to fetch`);
    }

    // Add fetched schema to our collection
    allSchema.push(...fetchedRemoteAdditionalSchema);

    // Process each fetched dependency recursively
    for (const dependencySchema of fetchedRemoteAdditionalSchema) {
      if (!processedClasses.has(dependencySchema.className)) {
        await runSchemaConversion(
          dependencySchema.className,
          options,
          [...schema, ...allSchema], // Use all accumulated schema
          dependencySchema.fields,
          tsPath,
          processedClasses,
          allSchema, // Pass the accumulating array
          conversions // Pass the conversions map
        );
      }
    }
  }

  const externalDeps = Array.from(
    conversion.dependencies.externalDependencies.values()
  );
  const internalDeps = Array.from(
    conversion.dependencies.internalDependencies.values()
  );
  const importDeps = Array.from(
    conversion.dependencies.importDependencies.values()
  );

  if (externalDeps.length > 0) {
    console.log(`   🌐 External dependencies: ${externalDeps.join(", ")}`);
  }
  if (internalDeps.length > 0) {
    console.log(`   🏠 Internal dependencies: ${internalDeps.join(", ")}`);
  }
  if (importDeps.length > 0) {
    console.log(`   📦 Custom imports: ${importDeps.length} import(s)`);
  }
  if (
    externalDeps.length === 0 &&
    internalDeps.length === 0 &&
    importDeps.length === 0
  ) {
    console.log(`   ✨ No dependencies found`);
  }
}

/**
 * Validates that all dependencies can be resolved before writing files.
 * @param conversions Map of all TypeScript conversions
 * @param allSchema Complete schema including fetched dependencies
 * @throws Error if validation fails
 */
export function validateDependencies(
  conversions: Map<string, TypescriptConversion>,
  allSchema: SchemaInterface[]
): void {
  const availableClasses = new Set(allSchema.map((s) => s.className));
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log("🔍 Validating dependencies...");

  for (const [className, conversion] of conversions) {
    // Collect all dependencies
    const externalDeps = Array.from(
      conversion.dependencies.externalDependencies
    );
    const internalDeps = Array.from(
      conversion.dependencies.internalDependencies
    );
    const allDeps = [...externalDeps, ...internalDeps];

    // Check for missing dependencies
    for (const dep of allDeps) {
      if (!availableClasses.has(dep) && !dep.startsWith("_")) {
        errors.push(`${className} depends on missing class: ${dep}`);
      }
    }

    // Check for potential circular dependencies
    for (const dep of internalDeps) {
      const depConversion = conversions.get(dep);
      if (depConversion?.dependencies.internalDependencies.has(className)) {
        warnings.push(`Potential circular dependency: ${className} <-> ${dep}`);
      }
    }

    // Check for self-referencing dependencies
    if (internalDeps.includes(className) || externalDeps.includes(className)) {
      warnings.push(`${className} references itself as a dependency`);
    }
  }

  // Log warnings
  if (warnings.length > 0) {
    console.log("⚠️  Dependency warnings:");
    warnings.forEach((warning) => console.log(`   ${warning}`));
  }

  // Throw errors if any
  if (errors.length > 0) {
    console.error("❌ Dependency validation failed:");
    errors.forEach((error) => console.error(`   ${error}`));
    throw new Error(
      `Dependency validation failed with ${
        errors.length
      } error(s):\n${errors.join("\n")}`
    );
  }

  console.log(
    `✅ Dependencies validated: ${conversions.size} classes, ${availableClasses.size} available schemas`
  );
}

/**
 * Generates a visual dependency graph for debugging purposes.
 * @param conversions Map of all TypeScript conversions
 * @returns String representation of the dependency graph
 */
export function generateDependencyGraph(
  conversions: Map<string, TypescriptConversion>
): string {
  const lines: string[] = [];
  lines.push("=== DEPENDENCY GRAPH ===");
  lines.push("");

  for (const [className, conversion] of conversions) {
    lines.push(`${className}:`);

    const internalDeps = Array.from(
      conversion.dependencies.internalDependencies
    );
    const externalDeps = Array.from(
      conversion.dependencies.externalDependencies
    );
    const importDeps = Array.from(conversion.dependencies.importDependencies);

    if (internalDeps.length > 0) {
      lines.push(`  → Internal: ${internalDeps.join(", ")}`);
    }
    if (externalDeps.length > 0) {
      lines.push(`  → External: ${externalDeps.join(", ")}`);
    }
    if (importDeps.length > 0) {
      lines.push(`  → Imports: ${importDeps.length} custom import(s)`);
    }
    if (
      internalDeps.length === 0 &&
      externalDeps.length === 0 &&
      importDeps.length === 0
    ) {
      lines.push(`  → No dependencies`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function resolveAndWriteFiles(
  conversions: Map<string, TypescriptConversion>,
  allSchema: SchemaInterface[],
  tsPath: string,
  verbose: boolean = false
) {
  console.log("🔄 Resolving all dependencies...");

  // Validate dependencies before proceeding
  validateDependencies(conversions, allSchema);

  // Generate dependency graph if verbose mode is enabled
  if (verbose) {
    console.log(generateDependencyGraph(conversions));
  }

  // Re-evaluate all dependencies now that we have the complete schema
  for (const [className, conversion] of conversions) {
    // Move external dependencies that are now available to internal
    const externalDeps = Array.from(
      conversion.dependencies.externalDependencies
    );
    const internalDeps = Array.from(
      conversion.dependencies.internalDependencies
    );

    conversion.dependencies.externalDependencies.clear();
    conversion.dependencies.internalDependencies.clear();

    // Re-classify all dependencies
    const allDeps = [...externalDeps, ...internalDeps];
    for (const dep of allDeps) {
      if (allSchema.find((s) => s.className === dep)) {
        conversion.dependencies.internalDependencies.add(dep);
      } else {
        conversion.dependencies.externalDependencies.add(dep);
      }
    }
  }

  // Now write all files with resolved dependencies
  console.log(`📁 Writing ${conversions.size} TypeScript files...`);
  for (const [className, conversion] of conversions) {
    console.log(`   💾 Creating file for ${className}`);
    conversion.writeFile(tsPath);
  }
}
