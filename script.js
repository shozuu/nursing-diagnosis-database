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

    // Keep the original data structure without transformation
    // Our generateCardHTML() function will handle field variations
    diagnosesData = data;

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
function performSearch(query = "") {
  console.log("Search query:", query);

  // Always apply the current filter first
  let dataToSearch = applyFilter(diagnosesData, currentFilter);

  // Clear any previous search metadata
  dataToSearch.forEach((diagnosis) => {
    delete diagnosis._searchMeta;
  });

  if (!query.trim()) {
    // Empty search: show all diagnoses for the current filter
    filteredData = [...dataToSearch];
  } else {
    // Non-empty search: filter results
    const searchTerms = query
      .toLowerCase()
      .split(" ")
      .filter((term) => term.length > 0);

    let matchedResults = [];

    dataToSearch.forEach((diagnosis) => {
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

    // Sort by relevance (score)
    matchedResults.sort((a, b) => b.score - a.score);

    // Create filtered data with search metadata
    filteredData = matchedResults.map((result) => {
      result.diagnosis._searchMeta = {
        score: result.score,
        matchedFields: result.matchedFields,
        query: query.toLowerCase(),
        searchTerms: searchTerms,
      };
      return result.diagnosis;
    });
  }

  // Reset to first page and update display
  currentPage = 1;
  updatePagination();
  displayCurrentPage();
  updateResultsCount(filteredData.length, dataToSearch.length);

  // Show/hide clear button
  clearBtn.style.display = query.trim() ? "block" : "none";
}

// Search only in diagnosis titles
function searchInDiagnosisTitle(diagnosis, searchTerms, originalQuery) {
  let totalScore = 0;
  let matchedFields = [];
  let found = false;

  console.log(
    "Searching diagnosis:",
    diagnosis.diagnosis,
    "for terms:",
    searchTerms
  );

  // Search in the diagnosis title
  const titleResult = searchInField(
    diagnosis.diagnosis,
    searchTerms,
    originalQuery
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

// Escape special characters for regex
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Search within a specific field
function searchInField(fieldContent, searchTerms, originalQuery) {
  if (!fieldContent) {
    return { found: false, score: 0 };
  }

  const fieldLower = fieldContent.toLowerCase();
  let score = 0;
  let termMatches = 0;

  // Check for exact phrase match
  if (fieldLower.includes(originalQuery)) {
    score += 1000; // High score for exact phrase
    return { found: true, score };
  }

  // Check individual terms
  searchTerms.forEach((term) => {
    if (fieldLower.includes(term)) {
      termMatches++;
      score += 100; // Base score per term

      // Bonus for word boundary matches
      const wordBoundaryRegex = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
      if (wordBoundaryRegex.test(fieldContent)) {
        score += 50;
      }

      // Bonus for position (earlier = better)
      const position = fieldLower.indexOf(term);
      const positionBonus = Math.max(0, 50 - position);
      score += positionBonus;
    }
  });

  const found = termMatches > 0;
  return { found, score };
}

// Apply filter to data
function applyFilter(data, filter) {
  if (filter === "all") {
    return data;
  }

  return data.filter((diagnosis) => {
    const diagnosisLower = diagnosis.diagnosis.toLowerCase();
    switch (filter) {
      case "risk":
        return diagnosisLower.startsWith("risk for");
      case "readiness":
        return diagnosisLower.startsWith("readiness for enhanced");
      case "actual":
        return (
          !diagnosisLower.startsWith("risk for") &&
          !diagnosisLower.startsWith("readiness for enhanced")
        );
      default:
        return true;
    }
  });
}

// Create diagnosis card HTML and handle interactions
function createDiagnosisCard(diagnosis) {
  // Determine card type for styling
  const getCardType = (diagnosisName) => {
    const name = diagnosis.diagnosis.toLowerCase();
    if (name.startsWith("risk for")) return "risk";
    if (name.startsWith("readiness for enhanced")) return "readiness";
    return "actual";
  };

  const cardType = getCardType(diagnosis.diagnosis);

  // Create card element
  const cardElement = document.createElement("div");
  cardElement.className = `diagnosis-card diagnosis-card--${cardType}`;

  // Generate card HTML
  cardElement.innerHTML = generateCardHTML(diagnosis, cardType);

  // Add click event listener for modal
  addCardEventListeners(cardElement, diagnosis);

  return cardElement;
}

// Generate the HTML content for a card
function generateCardHTML(diagnosis, cardType) {
  // Helper function to safely handle content that might be string or array
  const normalizeContent = (content) => {
    if (!content) return [];
    if (Array.isArray(content)) return content;
    if (typeof content === "string") return [content];
    return [];
  };

  // Helper function to get field content with multiple possible field names
  const getFieldContent = (fieldNames) => {
    for (const fieldName of fieldNames) {
      if (diagnosis[fieldName]) {
        return diagnosis[fieldName];
      }
    }
    return null;
  };

  // Helper function to create sections for card content with better display
  const createSection = (title, content, options = {}) => {
    const normalizedContent = normalizeContent(content);
    if (normalizedContent.length === 0) return "";

    const { maxItems = 3, showCount = true } = options;
    const displayItems = normalizedContent.slice(0, maxItems);
    const hasMore = normalizedContent.length > maxItems;

    let contentHTML;
    if (displayItems.length === 1) {
      // Single item: display as simple text
      contentHTML = `<div class="section-content-text">${displayItems[0]}</div>`;
    } else {
      // Multiple items: display as list
      contentHTML = `
        <ul class="section-content-list">
          ${displayItems
            .map((item) => `<li class="section-list-item">${item}</li>`)
            .join("")}
          ${
            hasMore
              ? `<li class="section-more-indicator">+${
                  normalizedContent.length - maxItems
                } more...</li>`
              : ""
          }
        </ul>
      `;
    }

    const countText =
      showCount && normalizedContent.length > 1
        ? ` (${normalizedContent.length})`
        : "";

    return `
      <div class="section">
        <div class="section-title">${title}${countText}</div>
        ${contentHTML}
      </div>
    `;
  };

  // Get field content using all possible field name variations
  const definingCharacteristics = getFieldContent(["defining_characteristics"]);
  const relatedFactors = getFieldContent(["related_factors"]);
  const riskFactors = getFieldContent(["risk_factors"]);
  const associatedConditions = getFieldContent(["associated_conditions"]);
  const atRiskPopulation = getFieldContent(["at-risk_population"]);

  // Handle NOC outcomes variations
  const nocOutcomes = getFieldContent([
    "suggested_noc_outcomes",
    "suggested_noc_outcome",
    "suggested_noc_outcomes_(visual)",
    "suggested_noc_outcomes_and_example",
  ]);

  // Handle NIC interventions variations
  const nicInterventions = getFieldContent([
    "suggested_nic_interventions",
    "suggested_nic_intervention",
    "suggested_nursing_interventions",
  ]);

  // Handle client outcomes (can be object or array)
  const clientOutcomes = diagnosis.client_outcomes;
  let clientOutcomesContent = null;
  if (clientOutcomes) {
    if (typeof clientOutcomes === "object" && clientOutcomes.outcomes) {
      clientOutcomesContent = clientOutcomes.outcomes;
    } else {
      clientOutcomesContent = clientOutcomes;
    }
  }

  // Handle references field variations (all the long field names)
  const referencesContent = getFieldContent([
    "noc,_nic,_client_outcomes,_nursing_interventions_and_rationales,_and_references",
    "nic,_noc,_client_outcomes,_nursing_interventions_and_rationales,_and_references",
    "nic,_noc,_client_outcomes,_nursing_interventions_and_rationales,_client/family_teaching,_and_references",
    "nic,_noc,_client_outcomes,_nursing_interventions_and_rationales,_client/family_teaching_and_discharge_planning,_and_references",
    "nic,_noc,_client_outcomes,_nursing_interventions_and_rationales,_client/family_teaching_and_discharge_planning_and_references",
    "nic,_noc,_client_outcomes,_nursing_interventions_and_rationales_,_client/family_teaching,_and_references",
    "noc,_nic,_client_outcomes,_nursing_interventions_and_rationales,_client/family_teaching,_and_references",
    "noc,_nic,_client_outcomes,_nursing_interventions_and_rationales,_client/family_teaching_and_discharge_planning,_and_references",
  ]);

  return `
    <div class="diagnosis-title">
      <span class="diagnosis-text">${diagnosis.diagnosis}</span>
      ${
        diagnosis.page_num
          ? `<span class="page-number">Page ${diagnosis.page_num}</span>`
          : ""
      }
    </div>
    <div class="diagnosis-content">
      ${
        diagnosis.definition
          ? `
        <div class="section definition-section">
          <div class="section-title">Definition</div>
          <div class="section-content-text definition-text">${diagnosis.definition}</div>
        </div>
      `
          : ""
      }
      ${createSection("Defining Characteristics", definingCharacteristics, {
        maxItems: 4,
      })}
      ${createSection("Related Factors", relatedFactors, { maxItems: 3 })}
      ${createSection("Risk Factors", riskFactors, { maxItems: 3 })}
      ${createSection("Associated Conditions", associatedConditions, {
        maxItems: 2,
      })}
      ${createSection("At Risk Population", atRiskPopulation, { maxItems: 2 })}
      ${createSection("Client Outcomes", clientOutcomesContent, {
        maxItems: 2,
      })}
      ${createSection("Suggested NOC Outcomes", nocOutcomes, { maxItems: 2 })}
      ${createSection("Suggested NIC Interventions", nicInterventions, {
        maxItems: 2,
      })}
      ${
        referencesContent
          ? createSection("References", referencesContent, {
              maxItems: 1,
              showCount: false,
            })
          : ""
      }
    </div>
  `;
}

// Add event listeners to card element
function addCardEventListeners(cardElement, diagnosis) {
  cardElement.addEventListener("click", function (e) {
    console.log("Card clicked!", diagnosis);
    // Don't open modal if clicking on specific interactive elements
    if (e.target.closest(".page-number")) {
      console.log("Interactive element clicked, modal not opened.");
      return;
    }

    openDiagnosisModal(diagnosis);
  });

  // Add hover effects and accessibility
  cardElement.setAttribute("tabindex", "0");
  cardElement.setAttribute("role", "button");
  cardElement.setAttribute(
    "aria-label",
    `View details for ${diagnosis.diagnosis}`
  );

  // Keyboard support
  cardElement.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDiagnosisModal(diagnosis);
    }
  });
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

  // Log only the diagnoses that are displayed on the current page
  console.log(
    "First few diagnoses:",
    currentPageData.map((d) => d.diagnosis)
  );

  // Add loading state
  resultsContainer.style.opacity = "0.7";
  resultsContainer.style.transition = "opacity 0.3s ease";

  currentPageData.forEach((diagnosis, index) => {
    setTimeout(() => {
      // Create card element with integrated event handling
      const cardElement = createDiagnosisCard(diagnosis);

      // Add initial animation state
      cardElement.style.opacity = "0";
      cardElement.style.transform = "translateY(20px)";
      cardElement.style.transition = "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)";

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

// Create debounced search for better performance
const debouncedSearch = debounce((query) => {
  performSearch(query);
}, 300);

// Centralized search event listener setup
function setupSearchListeners() {
  // Input event with debounce for better performance
  searchInput.addEventListener("input", (e) => {
    debouncedSearch(e.target.value);
  });

  // Enter key for immediate search
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      performSearch(e.target.value);
    }
  });

  // Clear button functionality
  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearBtn.style.display = "none";
    performSearch("");
    searchInput.focus();
  });
}

// Setup filter button listeners
function setupFilterListeners() {
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
}

// Setup pagination event listeners
function setupPaginationListeners() {
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
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  nextPageBtn.addEventListener("click", () => {
    if (currentPage < totalPages) {
      currentPage++;
      updatePagination();
      displayCurrentPage();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

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
}

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
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    // Reset input to current page if invalid
    jumpToPageInput.value = currentPage;
  }
}

// Setup keyboard shortcuts
function setupKeyboardListeners() {
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

    // Pagination keyboard navigation
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
}

// Modal functionality - declare variables at top level
let modal,
  modalTitle,
  modalPageNumber,
  modalDefinition,
  modalSections,
  modalClose;

// Centralized modal opening function
function openDiagnosisModal(diagnosis) {
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

  // Populate basic modal content
  modalTitle.textContent = diagnosis.diagnosis;
  modalPageNumber.textContent =
    "Page " + (diagnosis.page_num || diagnosis.pageNum || "N/A");
  modalDefinition.textContent = diagnosis.definition;

  // Clear and populate sections
  modalSections.innerHTML = "";

  // Generate modal sections HTML
  const sectionsHTML = generateModalSections(diagnosis);

  if (sectionsHTML) {
    modalSections.innerHTML = sectionsHTML;
  } else {
    modalSections.innerHTML =
      "<div class='modal-section'>No additional information available.</div>";
  }

  // Show the modal
  modal.classList.add("active");
}

// Generate modal sections HTML
function generateModalSections(diagnosis) {
  // Helper function to get field content with multiple possible field names
  const getFieldContent = (fieldNames) => {
    for (const fieldName of fieldNames) {
      if (diagnosis[fieldName]) {
        return diagnosis[fieldName];
      }
    }
    return null;
  };

  // Helper function to normalize content (string or array)
  const normalizeContent = (content) => {
    if (!content) return [];
    if (Array.isArray(content)) return content;
    if (typeof content === "string") return [content];
    return [];
  };

  // Helper function to create modal sections with proper formatting
  const createModalSection = (title, content) => {
    const normalizedContent = normalizeContent(content);
    if (normalizedContent.length === 0) return "";

    // For modal, show all content (no truncation)
    const contentHTML =
      normalizedContent.length === 1
        ? normalizedContent[0]
        : `<ul class="modal-content-list">${normalizedContent
            .map((item) => `<li>${item}</li>`)
            .join("")}</ul>`;

    return `
      <div class="modal-section">
        <h3 class="modal-section-title">${title}</h3>
        <div class="modal-section-content">
          ${contentHTML}
        </div>
      </div>
    `;
  };

  // Get field content using all possible field name variations
  const definingCharacteristics = getFieldContent(["defining_characteristics"]);
  const relatedFactors = getFieldContent(["related_factors"]);
  const riskFactors = getFieldContent(["risk_factors"]);
  const associatedConditions = getFieldContent(["associated_conditions"]);
  const atRiskPopulation = getFieldContent(["at-risk_population"]);

  // Handle NOC outcomes variations
  const nocOutcomes = getFieldContent([
    "suggested_noc_outcomes",
    "suggested_noc_outcome",
    "suggested_noc_outcomes_(visual)",
    "suggested_noc_outcomes_and_example",
  ]);

  // Handle NIC interventions variations
  const nicInterventions = getFieldContent([
    "suggested_nic_interventions",
    "suggested_nic_intervention",
    "suggested_nursing_interventions",
  ]);

  // Handle client outcomes (can be object or array)
  const clientOutcomes = diagnosis.client_outcomes;

  // Handle references field variations (all the long field names)
  const referencesContent = getFieldContent([
    "noc,_nic,_client_outcomes,_nursing_interventions_and_rationales,_and_references",
    "nic,_noc,_client_outcomes,_nursing_interventions_and_rationales,_and_references",
    "nic,_noc,_client_outcomes,_nursing_interventions_and_rationales,_client/family_teaching,_and_references",
    "nic,_noc,_client_outcomes,_nursing_interventions_and_rationales,_client/family_teaching_and_discharge_planning,_and_references",
    "nic,_noc,_client_outcomes,_nursing_interventions_and_rationales,_client/family_teaching_and_discharge_planning_and_references",
    "nic,_noc,_client_outcomes,_nursing_interventions_and_rationales_,_client/family_teaching,_and_references",
    "noc,_nic,_client_outcomes,_nursing_interventions_and_rationales,_client/family_teaching,_and_references",
    "noc,_nic,_client_outcomes,_nursing_interventions_and_rationales,_client/family_teaching_and_discharge_planning,_and_references",
  ]);

  // Build sections using comprehensive field handling
  let sectionsHTML = "";

  sectionsHTML += createModalSection(
    "Defining Characteristics",
    definingCharacteristics
  );
  sectionsHTML += createModalSection("Related Factors", relatedFactors);
  sectionsHTML += createModalSection("Risk Factors", riskFactors);
  sectionsHTML += createModalSection(
    "Associated Conditions",
    associatedConditions
  );
  sectionsHTML += createModalSection("At Risk Population", atRiskPopulation);
  sectionsHTML += createModalSection("Suggested NOC Outcomes", nocOutcomes);
  sectionsHTML += createModalSection(
    "Suggested NIC Interventions",
    nicInterventions
  );

  // Client Outcomes section (special handling for object structure)
  if (clientOutcomes) {
    if (typeof clientOutcomes === "object" && clientOutcomes.outcomes) {
      sectionsHTML += `
        <div class="modal-section">
          <h3 class="modal-section-title">Client Outcomes (${
            clientOutcomes.client_will || "Client Will"
          })</h3>
          <div class="modal-section-content">
            <ul class="outcomes-list">
              ${clientOutcomes.outcomes
                .map((outcome) => `<li class="outcome-item">${outcome}</li>`)
                .join("")}
            </ul>
          </div>
        </div>
      `;
    } else {
      sectionsHTML += createModalSection("Client Outcomes", clientOutcomes);
    }
  }

  // References section
  if (referencesContent) {
    sectionsHTML += createModalSection("References", referencesContent);
  }

  return sectionsHTML;
}

// Close modal function
function closeModal() {
  if (modal) {
    modal.classList.remove("active");
  }
}

// Setup modal event listeners
function setupModalListeners() {
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

  // Escape key to close modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.classList.contains("active")) {
      closeModal();
    }
  });
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

  // Setup all event listeners
  setupSearchListeners();
  setupFilterListeners();
  setupPaginationListeners();
  setupModalListeners();
  setupKeyboardListeners();

  // Load data and focus search
  loadData();
  searchInput.focus();
});
