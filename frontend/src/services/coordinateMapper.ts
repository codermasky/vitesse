/**
 * Coordinate Mapping Utility
 * 
 * Handles the mapping between financial field names and their source document coordinates.
 * Supports both PDF (bbox coordinates) and Excel (row/col coordinates) formats.
 */

export interface CoordinateMapping {
    field?: string;
    text?: string;
    page?: number;
    page_number?: number;
    bbox?: number[];
    coordinates?: number[];
    tax_year?: string;
    document_name?: string;
}

export interface SourceMapping {
    doc_id: string;
    document_name: string;
    page_number: number;
    coordinates: number[];
}

export interface Document {
    id: string;
    name: string;
    doc_type?: string;
    metadata?: Record<string, any>;
}

/**
 * Normalize coordinates to a standard format [x, y, width, height]
 */
export function normalizeCoordinates(
    coords: number[],
    format: 'bbox' | 'excel' = 'bbox'
): number[] {
    if (format === 'excel') {
        // Excel coordinates are [row, col] - return as-is for Excel handling
        return coords;
    }

    if (!coords || coords.length < 4) {
        return [0, 0, 0, 0];
    }

    // If bbox format is [x0, y0, x1, y1], convert to [x, y, width, height]
    if (coords[2] > coords[0] && coords[3] > coords[1]) {
        return [coords[0], coords[1], coords[2] - coords[0], coords[3] - coords[1]];
    }

    // Already in [x, y, width, height] format
    return coords;
}

/**
 * Find the document that corresponds to a specific year
 */
export function findDocumentForYear(
    year: string,
    documents: Document[],
    coordinateMappings: Record<string, CoordinateMapping[]>
): string | null {
    // First, try to find in coordinate mappings where tax_year field matches
    for (const [docId, mappings] of Object.entries(coordinateMappings)) {
        const yearMapping = mappings.find((m) => {
            const fieldMatch = m.field === 'tax_year' || m.field === 'year';
            const textMatch = m.text && m.text.includes(year);
            return fieldMatch && textMatch;
        });

        if (yearMapping) {
            return docId;
        }
    }

    // Second, try to find by document name pattern (e.g., "2023_tax_return.pdf")
    const docMatch = documents.find((doc) => doc.name.includes(year));
    if (docMatch) {
        return docMatch.id;
    }

    // Third, try document metadata
    const metadataMatch = documents.find(
        (doc) => doc.metadata?.tax_year === year || doc.metadata?.year === year
    );
    if (metadataMatch) {
        return metadataMatch.id;
    }

    return null;
}

/**
 * Calculate confidence score for a mapping match
 */
export function calculateMatchConfidence(
    mapping: CoordinateMapping,
    searchField: string,
    searchYear?: string
): number {
    let confidence = 0;

    const mappingField = (mapping.field || '').toLowerCase();
    const mappingText = (mapping.text || '').toLowerCase();
    const normalizedSearch = searchField.toLowerCase();

    // Exact field match - highest confidence
    if (mappingField === normalizedSearch) {
        confidence += 1.0;
    }
    // Field contains search or vice versa - high confidence
    else if (mappingField.includes(normalizedSearch) || normalizedSearch.includes(mappingField)) {
        confidence += 0.7;
    }
    // Text contains search term - medium confidence
    else if (mappingText.includes(normalizedSearch)) {
        confidence += 0.5;
    }

    // Year match bonus
    if (searchYear && mapping.tax_year === searchYear) {
        confidence += 0.3;
    }

    // Fuzzy matching for common financial terms - lower confidence bonus
    const fuzzyMatches = [
        // Revenue variations
        {
            search: ['revenue', 'gross revenue', 'total revenue'],
            mappings: ['revenue', 'receipts', 'sales', 'gross receipts', 'gross sales'],
            bonus: 0.4,
        },
        // Income variations
        {
            search: ['income', 'net income', 'ordinary business income'],
            mappings: ['income', 'net income', 'ordinary business income', 'ordinary income'],
            bonus: 0.4,
        },
        // Expense variations
        {
            search: ['expense', 'expenses', 'operating expense', 'operating expenses'],
            mappings: ['expense', 'expenses', 'salaries', 'rent', 'utilities'],
            bonus: 0.3,
        },
        // COGS variations
        {
            search: ['cogs', 'cost of goods sold', 'cost of goods'],
            mappings: ['cost of goods', 'cogs', 'cost of sales'],
            bonus: 0.4,
        },
    ];

    for (const fuzzy of fuzzyMatches) {
        const searchMatches = fuzzy.search.some((s) => normalizedSearch.includes(s));
        const mappingMatches = fuzzy.mappings.some(
            (m) => mappingField.includes(m) || mappingText.includes(m)
        );
        if (searchMatches && mappingMatches) {
            confidence += fuzzy.bonus;
            break;
        }
    }

    return Math.min(confidence, 1.0); // Cap at 1.0
}

/**
 * Find the coordinate mapping for a specific field and optionally a year
 */
export function findCoordinateMapping(
    fieldName: string,
    year: string | undefined,
    coordinateMappings: Record<string, CoordinateMapping[]>,
    documents: Document[]
): SourceMapping | null {
    // First, try to find the document for the specific year if provided
    let targetDocId: string | null = null;
    if (year) {
        targetDocId = findDocumentForYear(year, documents, coordinateMappings);
    }

    // Prepare sorted document entries (prioritize target year's document)
    const docEntries = Object.entries(coordinateMappings);
    const sortedDocs = targetDocId
        ? [
            ...docEntries.filter(([id]) => id === targetDocId),
            ...docEntries.filter(([id]) => id !== targetDocId),
        ]
        : docEntries;

    // Search through documents and find best matching mapping
    let bestMatch: { mapping: CoordinateMapping; docId: string; confidence: number } | null = null;

    for (const [docId, mappings] of sortedDocs) {
        if (!docId || !mappings || mappings.length === 0) continue;

        for (const mapping of mappings) {
            const confidence = calculateMatchConfidence(mapping, fieldName, year);

            // Only consider matches with confidence > 0.3
            if (confidence > 0.3) {
                if (!bestMatch || confidence > bestMatch.confidence) {
                    bestMatch = { mapping, docId, confidence };
                }
            }
        }
    }

    // If we found a good match, return it
    if (bestMatch && bestMatch.confidence > 0.5) {
        const { mapping, docId } = bestMatch;
        const document = documents.find((d) => d.id === docId);

        return {
            doc_id: docId,
            document_name: document?.name || mapping.document_name || docId,
            page_number: mapping.page || mapping.page_number || 1,
            coordinates: normalizeCoordinates(
                mapping.bbox || mapping.coordinates || [0, 0, 0, 0]
            ),
        };
    }

    // Fallback: return first document if no good match found
    const fallbackDoc = documents && documents.length > 0 ? documents[0] : null;
    if (fallbackDoc) {
        console.warn(
            `No coordinate mapping found for field "${fieldName}" (year: ${year}). Using fallback.`
        );
        return {
            doc_id: fallbackDoc.id,
            document_name: fallbackDoc.name,
            page_number: 1,
            coordinates: [100, 200, 120, 30], // Default safe coordinates
        };
    }

    // No documents available
    console.error(`No documents available to map field "${fieldName}"`);
    return null;
}

/**
 * Validate coordinate data
 */
export function validateCoordinates(coords: number[], pageWidth?: number, pageHeight?: number): boolean {
    if (!coords || coords.length < 4) {
        return false;
    }

    const [x, y, width, height] = coords;

    // Basic sanity checks
    if (x < 0 || y < 0 || width <= 0 || height <= 0) {
        return false;
    }

    // If page dimensions are provided, check bounds
    if (pageWidth && pageHeight) {
        if (x + width > pageWidth || y + height > pageHeight) {
            return false;
        }
    }

    return true;
}
