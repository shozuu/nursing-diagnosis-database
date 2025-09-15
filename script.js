// Load the JSON data
let diagnosesData = [];
let filteredData = [];
let currentFilter = "all";

// Pagination variables
let currentPage = 1;
let itemsPerPage = 12;
let totalPages = 1;

// DOM Elements
const searchInput = document.getElementById("searchInput");
const clearBtn = document.getElementById("clearSearch");
const resultsContainer = document.getElementById("resultsContainer");
const resultsCount = document.getElementById("resultsCount");
const noResults = document.getElementById("noResults");
const filterBtns = document.querySelectorAll(".filter-btn");

// Pagination DOM Elements
const paginationContainer = document.getElementById("paginationContainer");
const pageInfo = document.getElementById("pageInfo");
const itemsPerPageSelect = document.getElementById("itemsPerPage");
const prevPageBtn = document.getElementById("prevPage");
const nextPageBtn = document.getElementById("nextPage");
const pageNumbers = document.getElementById("pageNumbers");
const jumpToPageInput = document.getElementById("jumpToPageInput");
const jumpToPageBtn = document.getElementById("jumpToPageBtn");

// Load data from JSON file
async function loadData() {
  try {
    const response = await fetch("new_nnn_content.json");
    const data = await response.json();

    diagnosesData = data.map((item) => {
      return {
        diagnosis: item.diagnosis,
        pageNum: item.page_num,
        definition: item.definition,
        definingCharacteristics: item.defining_characteristics || [],
        relatedFactors: item.related_factors || [],
        riskFactors: item.risk_factors || [],
        atRiskPopulation: item["at-risk_population"] || [],
        associatedConditions: item.associated_conditions || [],
        suggestedNOCOutcomes: item.suggested_noc_outcomes || [],
        suggestedNICInterventions: item.suggested_nic_interventions || [],
        clientOutcomes: item.client_outcomes || null,
        references:
          item[
            "noc,_nic,_client_outcomes,_nursing_interventions_and_rationales,_and_references"
          ] || null,
      };
    });

    filteredData = diagnosesData;
    updatePagination();
    displayCurrentPage();
    updateResultsCount(filteredData.length, diagnosesData.length);
  } catch (error) {
    console.error("Error loading data:", error);
    resultsContainer.innerHTML =
      '<div class="error">Error loading data. Please try again.</div>';
  }
}

// Search functionality
// Add debugging logs to performSearch
function performSearch(query = "") {
  console.log("Search query:", query);

  if (!query.trim()) {
    // Clear the search metadata for all diagnoses
    diagnosesData.forEach((diagnosis) => {
      delete diagnosis._searchMeta;
    });
    filteredData = applyFilter(diagnosesData, currentFilter);
    console.log("Filtered data after clearing search:", filteredData);

    // Clear any stored search metadata
    filteredData.forEach((diagnosis) => {
      delete diagnosis._searchMeta;
    });
  } else {
    const searchTerms = query
      .toLowerCase()
      .split(" ")
      .filter((term) => term.length > 0);

    console.log("Search terms:", searchTerms);

    // First apply any active filters to get the base dataset
    let baseData = applyFilter(diagnosesData, currentFilter);
    console.log("Base data after applying filter:", baseData);

    // Search across all fields and calculate relevance scores
    let matchedResults = [];

    baseData.forEach((diagnosis) => {
      const searchResult = searchInDiagnosisTitle(
        diagnosis,
        searchTerms,
        query.toLowerCase()
      );

      if (searchResult.found) {
        matchedResults.push({
          diagnosis,
          score: searchResult.score,
          matchedFields: searchResult.matchedFields,
        });
      }
    });

    console.log("Matched results:", matchedResults);

    // Sort by relevance score (higher scores first)
    matchedResults.sort((a, b) => b.score - a.score);

    // Extract diagnosis objects and store search metadata
    filteredData = matchedResults.map((result) => {
      // Store search metadata for highlighting and display purposes
      result.diagnosis._searchMeta = {
        score: result.score,
        matchedFields: result.matchedFields,
        query: query.toLowerCase(),
        searchTerms: searchTerms,
      };
      return result.diagnosis;
    });

    console.log("Filtered data after search:", filteredData);
  }

  currentPage = 1;
  updatePagination();
  displayCurrentPage();
  updateResultsCount(filteredData.length, diagnosesData.length);

  // Show/hide clear button
  clearBtn.style.display = query.trim() ? "block" : "none";
}

// Search only in diagnosis titles
function searchInDiagnosisTitle(diagnosis, searchTerms, originalQuery) {
  let totalScore = 0;
  let matchedFields = [];
  let found = false;

  // Field weight for diagnosis title
  const diagnosisWeight = 200;

  console.log(
    "Searching diagnosis:",
    diagnosis.diagnosis,
    "for terms:",
    searchTerms
  );

  // Search only in diagnosis title
  const titleResult = searchInField(
    diagnosis.diagnosis,
    searchTerms,
    originalQuery,
    diagnosisWeight
  );

  console.log("Title result for", diagnosis.diagnosis, ":", titleResult);

  if (titleResult.found) {
    totalScore += titleResult.score;
    matchedFields.push("diagnosis");
    found = true;
  }

  // Bonus for title matches
  if (matchedFields.includes("diagnosis")) {
    totalScore += 500; // Extra bonus for title matches
  }

  console.log("Final result for", diagnosis.diagnosis, ":", {
    found,
    score: totalScore,
    matchedFields,
  });

  return {
    found,
    score: totalScore,
    matchedFields,
  };
}

// Search within a specific field
function searchInField(fieldText, searchTerms, originalQuery, weight) {
  if (!fieldText || typeof fieldText !== "string")
    return { found: false, score: 0 };

  const text = fieldText.toLowerCase();
  let score = 0;
  let found = false;

  console.log("Searching field text:", text, "for terms:", searchTerms);

  // Check if all search terms are present
  const allTermsFound = searchTerms.every((term) => text.includes(term));

  console.log("All terms found:", allTermsFound);

  if (!allTermsFound) {
    return { found: false, score: 0 };
  }

  found = true;

  // Exact phrase match (highest score)
  if (text.includes(originalQuery)) {
    score += weight * 2;
  }

  // Exact match bonus
  if (text === originalQuery) {
    score += weight * 3;
  }

  // Starts with query bonus
  if (text.startsWith(originalQuery)) {
    score += weight * 1.5;
  }

  console.log("Field search result:", { found, score });

  return { found, score };
}

// Calculate relevance score for search results (legacy function, now used by searchInField)
function calculateRelevanceScore(title, searchTerms, originalQuery) {
  let score = 0;

  // Bonus for exact match of the entire query
  if (title === originalQuery) {
    score += 1000;
  }

  // Bonus for exact match as a phrase
  if (title.includes(originalQuery)) {
    score += 500;
  }

  // Bonus for title starting with the search query
  if (title.startsWith(originalQuery)) {
    score += 300;
  }

  // Score based on individual term matches
  searchTerms.forEach((term) => {
    // Exact word match (word boundaries)
    const wordRegex = new RegExp(`\\b${escapeRegExp(term)}\\b`, "g");
    const wordMatches = (title.match(wordRegex) || []).length;
    score += wordMatches * 100;

    // Bonus if term appears at the beginning of the title
    if (title.startsWith(term)) {
      score += 50;
    }

    // Bonus for shorter titles (more specific matches)
    if (wordMatches > 0) {
      score += Math.max(0, 50 - title.length);
    }
  });

  // Penalty for longer titles (less specific)
  score -= title.length * 0.5;

  return score;
}

// Apply filter based on diagnosis type
function applyFilter(data, filter) {
  switch (filter) {
    case "risk":
      return data.filter((d) =>
        d.diagnosis.toLowerCase().startsWith("risk for")
      );
    case "actual":
      return data.filter(
        (d) =>
          !d.diagnosis.toLowerCase().startsWith("risk for") &&
          !d.diagnosis.toLowerCase().startsWith("readiness for enhanced")
      );
    case "readiness":
      return data.filter((d) =>
        d.diagnosis.toLowerCase().startsWith("readiness for enhanced")
      );
    default:
      return data;
  }
}

// Highlight search terms in text
// Update the highlightSearchTerms function to handle non-string values
function highlightSearchTerms(text, query) {
  if (!query.trim()) return text;

  const searchTerms = query
    .toLowerCase()
    .split(" ")
    .filter((term) => term.length > 1); // Ignore single characters

  if (searchTerms.length === 0) return text;

  // Sort terms by length (longest first) to avoid partial matches
  searchTerms.sort((a, b) => b.length - a.length);

  let result = typeof text === "string" ? text : ""; // Ensure result is a string

  // Process each search term
  searchTerms.forEach((term) => {
    // Split text by existing highlight tags to avoid nested highlighting
    const parts = result.split(/(<span class="highlight">.*?<\/span>)/gi);

    result = parts
      .map((part) => {
        // Don't process parts that are already highlighted
        if (part.toLowerCase().includes('<span class="highlight">')) {
          return part;
        }

        // Apply highlighting to non-highlighted parts
        const regex = new RegExp(`\b(${escapeRegExp(term)})\b`, "gi");
        return part.replace(regex, '<span class="highlight">$1</span>');
      })
      .join("");
  });

  return result;
}

// Escape special characters for regex
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Create diagnosis card HTML
function createDiagnosisCard(diagnosis) {
  // Determine card type for styling
  const getCardType = (diagnosisName) => {
    const name = diagnosisName.toLowerCase();
    if (name.startsWith("risk for")) return "risk";
    if (name.startsWith("readiness for enhanced")) return "readiness";
    return "actual";
  };

  const cardType = getCardType(diagnosis.diagnosis);

  // Helper function to create sections for card content
  const createSection = (title, content) => {
    if (!content || content.length === 0) return "";
    const text = Array.isArray(content) ? content.join(", ") : content;

    return `
      <div class="section">
        <div class="section-title">${title}</div>
        <div class="section-content-text">${text}</div>
      </div>
    `;
  };

  return `
    <div class="diagnosis-card diagnosis-card--${cardType}">
      <div class="diagnosis-title">
        <span class="diagnosis-text">${diagnosis.diagnosis}</span>
      </div>
      <div class="diagnosis-content">
        ${createSection("Characteristics", diagnosis.characteristics)}
        ${createSection("Related Factors", diagnosis.relatedFactors)}
        ${createSection(
          "Associated Conditions",
          diagnosis.associatedConditions
        )}
        ${createSection("At Risk Population", diagnosis.atRiskPopulation)}
        ${createSection("Suggested Outcomes", diagnosis.suggestedOutcomes)}
        ${createSection(
          "Suggested Interventions",
          diagnosis.suggestedInterventions
        )}
      </div>
    </div>
  `;
}

// Update pagination info
function updatePagination() {
  totalPages = Math.ceil(filteredData.length / itemsPerPage);

  if (totalPages === 0) {
    paginationContainer.style.display = "none";
    return;
  }

  paginationContainer.style.display = "block";

  // Update page info with more details
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, filteredData.length);
  pageInfo.textContent = `Showing ${startItem}-${endItem} of ${filteredData.length} results (Page ${currentPage} of ${totalPages})`;

  // Update navigation buttons with enhanced styling
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === totalPages;

  // Update jump to page input
  jumpToPageInput.max = totalPages;
  jumpToPageInput.value = currentPage;
  jumpToPageInput.placeholder = currentPage.toString();

  // Generate page numbers
  generatePageNumbers();
}

// Generate page number buttons - Mobile-first approach
function generatePageNumbers() {
  pageNumbers.innerHTML = "";

  // Determine max visible pages based on screen width
  const isVerySmall = window.innerWidth < 480;
  const isSmall = window.innerWidth < 640;

  let maxVisiblePages;
  if (isVerySmall) {
    maxVisiblePages = 3; // Show fewer pages on very small screens
  } else if (isSmall) {
    maxVisiblePages = 5;
  } else {
    maxVisiblePages = 7; // Show more on larger screens
  }

  // For very few pages, show all
  if (totalPages <= maxVisiblePages) {
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.appendChild(createPageButton(i));
    }
    return;
  }

  let startPage, endPage;

  if (isVerySmall) {
    // Very small screens: Show current page only, or current + 1 neighbor if space allows
    if (totalPages <= 3) {
      startPage = 1;
      endPage = totalPages;
    } else {
      startPage = Math.max(1, currentPage - 1);
      endPage = Math.min(totalPages, startPage + 2);

      // Adjust if we're too close to start or end
      if (endPage - startPage < 2) {
        if (startPage === 1) {
          endPage = Math.min(totalPages, 3);
        } else {
          startPage = Math.max(1, totalPages - 2);
        }
      }
    }
  } else if (isSmall) {
    // Small screens: Show current page and neighbors
    startPage = Math.max(1, currentPage - 2);
    endPage = Math.min(totalPages, currentPage + 2);

    // Adjust startPage if we're near the end
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }
  } else {
    // Desktop: Show more pages
    startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // Adjust startPage if we're near the end
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
  }

  // Always show first page if not in range (except on very small screens with limited space)
  if (startPage > 1 && !isVerySmall) {
    pageNumbers.appendChild(createPageButton(1));
    if (startPage > 2) {
      pageNumbers.appendChild(createEllipsis());
    }
  }

  // Show page numbers in range
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.appendChild(createPageButton(i));
  }

  // Always show last page if not in range (except on very small screens with limited space)
  if (endPage < totalPages && !isVerySmall) {
    if (endPage < totalPages - 1) {
      pageNumbers.appendChild(createEllipsis());
    }
    pageNumbers.appendChild(createPageButton(totalPages));
  }
}

// Create page button with enhanced interactions
function createPageButton(pageNum) {
  const button = document.createElement("button");
  button.className = `page-number-btn ${
    pageNum === currentPage ? "active" : ""
  }`;
  button.textContent = pageNum;
  button.setAttribute("aria-label", `Go to page ${pageNum}`);
  button.setAttribute("title", `Go to page ${pageNum}`);

  button.addEventListener("click", () => {
    if (pageNum !== currentPage) {
      currentPage = pageNum;
      updatePagination();
      displayCurrentPage();
      // Add smooth scroll to top
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  // Add keyboard navigation
  button.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      button.click();
    }
  });

  return button;
}

// Create ellipsis
function createEllipsis() {
  const span = document.createElement("span");
  span.className = "page-ellipsis";
  span.textContent = "...";
  return span;
}

// Display current page results
function displayCurrentPage() {
  resultsContainer.innerHTML = "";
  noResults.style.display = "none";

  console.log(
    "Displaying page with filteredData:",
    filteredData.length,
    "items"
  );
  console.log(
    "First few diagnoses:",
    filteredData.slice(0, 5).map((d) => d.diagnosis)
  );

  if (filteredData.length === 0) {
    noResults.style.display = "block";
    paginationContainer.style.display = "none";
    return;
  }

  // Sort results: preserve relevance order for search results, otherwise sort by diagnosis name
  let sortedData;
  if (filteredData.length > 0 && filteredData[0]._searchMeta) {
    // Already sorted by relevance in performSearch
    sortedData = [...filteredData];
  } else {
    // Sort alphabetically for non-search results
    sortedData = [...filteredData].sort((a, b) =>
      a.diagnosis.localeCompare(b.diagnosis)
    );
  }

  // Calculate start and end indices for current page
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, sortedData.length);
  const currentPageData = sortedData.slice(startIndex, endIndex);

  // Add loading state
  resultsContainer.style.opacity = "0.7";
  resultsContainer.style.transition = "opacity 0.3s ease";

  currentPageData.forEach((diagnosis, index) => {
    console.log(
      `Creating card ${index + 1}:`,
      diagnosis.diagnosis,
      "has searchMeta:",
      !!diagnosis._searchMeta
    );
    setTimeout(() => {
      // Create a temporary container to parse the HTML
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = createDiagnosisCard(diagnosis);
      const cardElement = tempDiv.firstElementChild;

      // Add initial animation state
      cardElement.style.opacity = "0";
      cardElement.style.transform = "translateY(20px)";
      cardElement.style.transition = "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)";

      // Add click event listener to open modal
      cardElement.addEventListener("click", function (e) {
        console.log("Card clicked!", diagnosis);
        // Don't open modal if clicking on specific interactive elements
        if (e.target.closest(".page-number")) {
          console.log("Interactive element clicked, modal not opened.");
          return;
        }

        openModal(diagnosis);
      });

      resultsContainer.appendChild(cardElement);

      // Trigger animation
      setTimeout(() => {
        cardElement.style.opacity = "1";
        cardElement.style.transform = "translateY(0)";
      }, 50);

      // Reinitialize Lucide icons for new content
      if (typeof lucide !== "undefined") {
        lucide.createIcons();
      }

      // Remove loading state after last item
      if (index === currentPageData.length - 1) {
        setTimeout(() => {
          resultsContainer.style.opacity = "1";
        }, 200);
      }
    }, index * 80); // Stagger the animation
  });

  // Scroll to top of results
  resultsContainer.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Update results count with search insights
function updateResultsCount(current, total) {
  const query = searchInput.value.trim();

  if (current === total) {
    resultsCount.textContent = `Showing all ${total} diagnoses`;
  } else if (query) {
    // Generate search insights for filtered results
    const insights = generateSearchInsights(filteredData);
    const insightsText =
      insights.length > 0 ? ` • ${insights.join(" • ")}` : "";
    resultsCount.innerHTML = `
      <div class="search-results-summary">
        <span class="results-count">Found ${current} of ${total} diagnoses</span>
        <span class="search-insights">${insightsText}</span>
      </div>
    `;
  } else {
    resultsCount.textContent = `Showing ${current} of ${total} diagnoses`;
  }
}

// Generate insights about search results
function generateSearchInsights(results) {
  if (!results.length || !results[0]._searchMeta) return [];

  const insights = [];

  // Count title matches
  const titleMatches = results.filter(
    (r) => r._searchMeta && r._searchMeta.matchedFields.includes("diagnosis")
  ).length;
  if (titleMatches > 0) {
    insights.push(
      `${titleMatches} title match${titleMatches !== 1 ? "es" : ""}`
    );
  }

  // Count definition matches
  const defMatches = results.filter(
    (r) => r._searchMeta && r._searchMeta.matchedFields.includes("definition")
  ).length;
  if (defMatches > 0) {
    insights.push(
      `${defMatches} definition match${defMatches !== 1 ? "es" : ""}`
    );
  }

  // Count other field matches
  const otherMatches = results.filter((r) => {
    if (!r._searchMeta) return false;
    return r._searchMeta.matchedFields.some(
      (field) => !["diagnosis", "definition"].includes(field)
    );
  }).length;

  if (otherMatches > 0) {
    insights.push(
      `${otherMatches} other field match${otherMatches !== 1 ? "es" : ""}`
    );
  }

  return insights;
}

// Event Listeners
searchInput.addEventListener("input", (e) => {
  performSearch(e.target.value);
});

searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    performSearch(e.target.value);
  }
});

clearBtn.addEventListener("click", () => {
  searchInput.value = "";
  clearBtn.style.display = "none";
  performSearch("");
  searchInput.focus();
});

// Filter buttons
filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    // Remove active class from all buttons
    filterBtns.forEach((b) => b.classList.remove("active"));
    // Add active class to clicked button
    btn.classList.add("active");

    // Update current filter
    currentFilter = btn.dataset.filter;

    // Reset to first page when changing filters
    currentPage = 1;

    // Apply filter and search
    performSearch(searchInput.value);
  });
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Focus search on Ctrl+F or Cmd+F
  if ((e.ctrlKey || e.metaKey) && e.key === "f") {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }

  // Clear search on Escape
  if (e.key === "Escape" && document.activeElement === searchInput) {
    clearBtn.click();
  }
});

// Pagination event listeners
itemsPerPageSelect.addEventListener("change", (e) => {
  itemsPerPage = parseInt(e.target.value);
  currentPage = 1;
  updatePagination();
  displayCurrentPage();
});

prevPageBtn.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    updatePagination();
    displayCurrentPage();
    // Add smooth scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

nextPageBtn.addEventListener("click", () => {
  if (currentPage < totalPages) {
    currentPage++;
    updatePagination();
    displayCurrentPage();
    // Add smooth scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

// Jump to page functionality
function jumpToPage() {
  const targetPage = parseInt(jumpToPageInput.value);
  if (
    targetPage >= 1 &&
    targetPage <= totalPages &&
    targetPage !== currentPage
  ) {
    currentPage = targetPage;
    updatePagination();
    displayCurrentPage();
    // Add smooth scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    // Reset input to current page if invalid
    jumpToPageInput.value = currentPage;
  }
}

jumpToPageBtn.addEventListener("click", jumpToPage);

jumpToPageInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    jumpToPage();
  }
});

jumpToPageInput.addEventListener("input", (e) => {
  const value = parseInt(e.target.value);
  if (value < 1) {
    e.target.value = 1;
  } else if (value > totalPages) {
    e.target.value = totalPages;
  }
});

jumpToPageInput.addEventListener("blur", (e) => {
  // Reset to current page if empty or invalid
  if (
    !e.target.value ||
    parseInt(e.target.value) < 1 ||
    parseInt(e.target.value) > totalPages
  ) {
    e.target.value = currentPage;
  }
});

// Keyboard navigation for pagination
document.addEventListener("keydown", (e) => {
  // Only handle pagination keys if search input is not focused
  if (document.activeElement !== searchInput) {
    if (e.key === "ArrowLeft" && currentPage > 1) {
      e.preventDefault();
      currentPage--;
      updatePagination();
      displayCurrentPage();
    } else if (e.key === "ArrowRight" && currentPage < totalPages) {
      e.preventDefault();
      currentPage++;
      updatePagination();
      displayCurrentPage();
    }
  }
});

// Initialize the app
document.addEventListener("DOMContentLoaded", () => {
  // Initialize modal elements
  modal = document.getElementById("diagnosisModal");
  modalTitle = document.getElementById("modalTitle");
  modalPageNumber = document.getElementById("modalPageNumber");
  modalDefinition = document.getElementById("modalDefinition");
  modalSections = document.getElementById("modalSections");
  modalClose = document.getElementById("modalClose");

  console.log("Modal elements initialized:", {
    modal,
    modalTitle,
    modalPageNumber,
    modalDefinition,
    modalSections,
    modalClose,
  });

  // Add modal event listeners
  if (modalClose) {
    modalClose.addEventListener("click", closeModal);
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  loadData();
  searchInput.focus();
});

// Add some utility functions for better UX
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Use debounced search for better performance
const debouncedSearch = debounce((query) => {
  performSearch(query);
}, 300);

// Replace the immediate search with debounced version for input events
searchInput.removeEventListener("input", (e) => {
  performSearch(e.target.value);
});

searchInput.addEventListener("input", (e) => {
  debouncedSearch(e.target.value);
});

// Modal functionality - declare variables at top level
let modal,
  modalTitle,
  modalPageNumber,
  modalDefinition,
  modalSections,
  modalClose;

function openModal(diagnosis) {
  // Ensure modal elements are initialized
  if (
    !modal ||
    !modalTitle ||
    !modalPageNumber ||
    !modalDefinition ||
    !modalSections
  ) {
    console.error("Modal elements are not initialized.");
    return;
  }

  // Populate modal content
  modalTitle.textContent = diagnosis.diagnosis;
  modalPageNumber.textContent = "Page " + diagnosis.pageNum;
  modalDefinition.textContent = diagnosis.definition;

  // Clear and populate sections
  modalSections.innerHTML = "";

  // Helper function to create modal sections with proper formatting
  const createModalSection = (title, content) => {
    if (!content || content.length === 0) return "";
    return `
      <div class="modal-section">
        <h3 class="modal-section-title">${title}</h3>
        <div class="modal-section-content">
          ${Array.isArray(content) ? content.join(", ") : content}
        </div>
      </div>
    `;
  };

  // Build sections using the same logic as cards but without truncation
  let sectionsHTML = "";

  sectionsHTML += createModalSection(
    "Characteristics",
    diagnosis.definingCharacteristics
  );
  sectionsHTML += createModalSection(
    "Related Factors",
    diagnosis.relatedFactors
  );
  sectionsHTML += createModalSection("Risk Factors", diagnosis.riskFactors);
  sectionsHTML += createModalSection(
    "Associated Conditions",
    diagnosis.associatedConditions
  );
  sectionsHTML += createModalSection(
    "At Risk Population",
    diagnosis.atRiskPopulation
  );
  sectionsHTML += createModalSection(
    "Suggested Outcomes",
    diagnosis.suggestedNOCOutcomes
  );
  sectionsHTML += createModalSection(
    "Suggested Interventions",
    diagnosis.suggestedNICInterventions
  );

  // Client Outcomes section
  if (diagnosis.clientOutcomes) {
    sectionsHTML += `
      <div class="modal-section">
        <h3 class="modal-section-title">Client Outcomes (${
          diagnosis.clientOutcomes.client_will
        })</h3>
        <div class="modal-section-content">
          <ul class="outcomes-list">
            ${diagnosis.clientOutcomes.outcomes
              .map((outcome) => `<li class="outcome-item">${outcome}</li>`)
              .join("")}
          </ul>
        </div>
      </div>
    `;
  }

  // References section
  if (diagnosis.references) {
    sectionsHTML += `
      <div class="modal-section">
        <h3 class="modal-section-title">References</h3>
        <div class="modal-section-content">
          <p>${diagnosis.references}</p>
        </div>
      </div>
    `;
  }

  if (sectionsHTML) {
    modalSections.innerHTML = sectionsHTML;
  } else {
    modalSections.innerHTML =
      "<div class='modal-section'>No additional information available.</div>";
  }

  // Show the modal
  modal.classList.add("active");
}

function closeModal() {
  if (modal) {
    modal.classList.remove("active");
  }
}

// Handle screen resize for responsive pagination
let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (filteredData.length > 0) {
      generatePageNumbers();
    }
  }, 150);
});

// Sticky search bar scroll effect
let ticking = false;

function updateSearchScrollEffect() {
  const searchSection = document.querySelector(".search-section");
  const scrollY = window.scrollY;

  if (scrollY > 50) {
    searchSection.classList.add("scrolled");
  } else {
    searchSection.classList.remove("scrolled");
  }

  ticking = false;
}

function requestScrollTick() {
  if (!ticking) {
    requestAnimationFrame(updateSearchScrollEffect);
    ticking = true;
  }
}

window.addEventListener("scroll", requestScrollTick);
