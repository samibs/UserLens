import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { ComponentMetadata } from '../models/interfaces';

export class CacheManager {
    private readonly cacheDir: string;
    private readonly metadataCacheDir: string;

    // Private constructor to be called by the static create method
    private constructor(projectRoot: string) {
        this.cacheDir = path.join(projectRoot, '.userlens_cache');
        this.metadataCacheDir = path.join(this.cacheDir, 'metadata');
    }

    /**
     * Creates and initializes a CacheManager instance.
     * Ensures that the necessary cache directories are created.
     * @param projectRoot The root directory of the project being analyzed.
     * @returns A promise that resolves to a CacheManager instance.
     */
    public static async create(projectRoot: string): Promise<CacheManager> {
        const instance = new CacheManager(projectRoot);
        try {
            // Ensure the metadata cache directory exists, creating it recursively if necessary.
            await fs.mkdir(instance.metadataCacheDir, { recursive: true });
        } catch (error) {
            console.error(`[CacheManager] Critical error: Failed to create cache directories at ${instance.metadataCacheDir}. Caching will not function.`, error);
            // This is a critical failure for the cache manager's operation.
            throw new Error(`Failed to initialize cache directories at ${instance.metadataCacheDir}: ${(error as Error).message}`);
        }
        return instance;
    }

    /**
     * Calculates the MD5 hash of a given string.
     * @param content The string content to hash.
     * @returns The MD5 hash as a hex string.
     */
    private calculateStringMD5(content: string): string {
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Generates the full path for a cache file based on the source file's relative path.
     * The cache filename is an MD5 hash of the source file's relative path.
     * @param sourceFilePath Relative path to the component's source file (e.g., 'src/components/Button.tsx').
     * @returns The absolute path to the cache file.
     */
    private getCacheFilePath(sourceFilePath: string): string {
        const relativePathHash = this.calculateStringMD5(sourceFilePath);
        return path.join(this.metadataCacheDir, `${relativePathHash}.json`);
    }

    /**
     * Retrieves a cached component's metadata and source file hash.
     * @param sourceFilePath Relative path to the component's source file.
     * @returns An object containing the source file hash and component metadata, or null if not found or on error.
     */
    public async getCachedComponent(sourceFilePath: string): Promise<{ sourceFileHash: string; componentMetadata: ComponentMetadata } | null> {
        const cacheFilePath = this.getCacheFilePath(sourceFilePath);
        try {
            const fileContent = await fs.readFile(cacheFilePath, 'utf-8');
            const data = JSON.parse(fileContent);

            // Basic validation for the cached data structure
            if (data && typeof data.sourceFileHash === 'string' && data.componentMetadata !== undefined) {
                return data as { sourceFileHash: string; componentMetadata: ComponentMetadata };
            } else {
                console.warn(`[CacheManager] Invalid or incomplete cache data found in ${cacheFilePath}. Discarding.`);
                // Attempt to remove the corrupted/invalid cache file to prevent future issues.
                await this.removeCachedComponent(sourceFilePath).catch(err => 
                    console.error(`[CacheManager] Failed to remove invalid cache file ${cacheFilePath}:`, err)
                );
                return null;
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                // File not found is a normal cache miss, not an error to log verbosely.
                return null;
            }
            console.error(`[CacheManager] Error reading or parsing cache file ${cacheFilePath}:`, error as Error);
            return null;
        }
    }

    /**
     * Caches a component's metadata along with the hash of its source file.
     * @param sourceFilePath Relative path to the component's source file.
     * @param sourceFileHash MD5 hash of the source file's content.
     * @param metadata The ComponentMetadata to cache.
     */
    public async cacheComponent(sourceFilePath: string, sourceFileHash: string, metadata: ComponentMetadata): Promise<void> {
        const cacheFilePath = this.getCacheFilePath(sourceFilePath);
        const dataToCache = {
            sourceFileHash,
            componentMetadata: metadata, // Storing the metadata object directly
        };
        try {
            const jsonData = JSON.stringify(dataToCache, null, 2); // Pretty print JSON
            await fs.writeFile(cacheFilePath, jsonData, 'utf-8');
        } catch (error) {
            console.error(`[CacheManager] Error writing cache file ${cacheFilePath}:`, error);
            // Propagate the error so the caller can decide how to handle it (e.g., log, retry, or ignore).
            throw new Error(`Failed to cache component data for ${sourceFilePath}: ${(error as Error).message}`);
        }
    }

    /**
     * Removes a cached component's data from the cache.
     * @param sourceFilePath Relative path to the component's source file.
     */
    public async removeCachedComponent(sourceFilePath: string): Promise<void> {
        const cacheFilePath = this.getCacheFilePath(sourceFilePath);
        try {
            await fs.unlink(cacheFilePath);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                // File doesn't exist, so it's already "removed". No action needed.
                return;
            }
            console.error(`[CacheManager] Error deleting cache file ${cacheFilePath}:`, error);
            // Propagate the error.
            throw new Error(`Failed to remove cached component data for ${sourceFilePath}: ${(error as Error).message}`);
        }
    }

    /**
     * Calculates the MD5 hash of a file's content.
     * @param absoluteFilePath The absolute path to the file.
     * @returns A promise that resolves to the MD5 hash of the file content.
     */
    public async calculateFileContentHash(absoluteFilePath: string): Promise<string> {
        try {
            const fileContent = await fs.readFile(absoluteFilePath, 'utf-8');
            return this.calculateStringMD5(fileContent);
        } catch (error) {
            console.error(`[CacheManager] Error reading file for hashing ${absoluteFilePath}:`, error);
            // Propagate the error.
            throw new Error(`Failed to calculate content hash for file ${absoluteFilePath}: ${(error as Error).message}`);
        }
    }

    /**
     * Retrieves all cached file keys (relative paths) from the metadata cache directory.
     * This is done by listing all .json files in the metadata cache directory and
     * then attempting to read each one to extract the original sourceFilePath.
     * This method assumes that the original sourceFilePath was stored in the cache file,
     * which might require an adjustment in how components are cached if not already done.
     * For now, it will return the hashed filenames, and the caller will need to manage
     * the mapping if necessary, or we adjust cacheComponent to store sourceFilePath.
     *
     * As a simpler first approach, this method will list the hashed filenames.
     * The design doc implies we need the original relative paths.
     * The current `getCacheFilePath` uses an MD5 hash of the *sourceFilePath* as the filename.
     * To get the original `sourceFilePath` back, we would need to store it *inside* each cache file.
     * Let's assume for now that `cacheComponent` is updated to store `sourceFilePath` inside the JSON.
     * If not, this method will need significant rework or the design for deleted files needs adjustment.
     *
     * Update: The current `cacheComponent` stores `componentMetadata` which includes `filePath`.
     * We can use this `filePath` (which should be the relative source path).
     *
     * @returns A promise that resolves to an array of relative source file paths.
     */
    public async getAllCachedFilePaths(): Promise<string[]> {
        const cachedFilePaths: string[] = [];
        try {
            const files = await fs.readdir(this.metadataCacheDir);
            for (const file of files) {
                if (path.extname(file) === '.json') {
                    const fullCachePath = path.join(this.metadataCacheDir, file);
                    try {
                        const fileContent = await fs.readFile(fullCachePath, 'utf-8');
                        const data = JSON.parse(fileContent);
                        // Assuming componentMetadata.filePath holds the original relative source path
                        if (data && data.componentMetadata && typeof data.componentMetadata.filePath === 'string') {
                            cachedFilePaths.push(data.componentMetadata.filePath);
                        } else {
                            console.warn(`[CacheManager] Cache file ${file} does not contain expected componentMetadata.filePath. Skipping.`);
                        }
                    } catch (readError) {
                        console.warn(`[CacheManager] Error reading or parsing cache file ${fullCachePath}. Skipping.`, readError);
                    }
                }
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                // If the metadata directory doesn't exist, there are no cached files.
                return [];
            }
            console.error(`[CacheManager] Error listing files in metadata cache directory ${this.metadataCacheDir}:`, error);
            // Depending on desired robustness, could throw or return empty list.
            // For now, return empty list as if no cache exists or is accessible.
            return [];
        }
        return cachedFilePaths;
    }
}