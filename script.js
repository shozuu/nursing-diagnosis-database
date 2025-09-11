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
    const response = await fetch("./nnn_content.json");
    diagnosesData = await response.json();
    filteredData = diagnosesData;
    currentPage = 1;
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
function performSearch(query) {
  if (!query.trim()) {
    filteredData = applyFilter(diagnosesData, currentFilter);
  } else {
    const searchTerms = query
      .toLowerCase()
      .split(" ")
      .filter((term) => term.length > 0);

    filteredData = diagnosesData.filter((diagnosis) => {
      const searchableText = [
        diagnosis.diagnosis,
        diagnosis.definition,
        ...(diagnosis.defining_characteristics || []),
        ...(diagnosis.associated_condition || []),
        ...(diagnosis.related_factors || []),
        ...(diagnosis.risk_factors || []),
        ...(diagnosis.at_risk_population || []),
        ...(diagnosis.suggested_noc_outcomes || []),
        ...(diagnosis.suggested_nic_interventions || []),
      ]
        .join(" ")
        .toLowerCase();

      return searchTerms.every((term) => searchableText.includes(term));
    });

    filteredData = applyFilter(filteredData, currentFilter);
  }

  currentPage = 1;
  updatePagination();
  displayCurrentPage();
  updateResultsCount(filteredData.length, diagnosesData.length);

  // Show/hide clear button
  clearBtn.style.display = query.trim() ? "block" : "none";
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
function highlightSearchTerms(text, query) {
  if (!query.trim()) return text;

  const searchTerms = query
    .toLowerCase()
    .split(" ")
    .filter((term) => term.length > 1); // Ignore single characters

  if (searchTerms.length === 0) return text;

  // Sort terms by length (longest first) to avoid partial matches
  searchTerms.sort((a, b) => b.length - a.length);

  let highlightedText = text;

  searchTerms.forEach((term) => {
    // Simple approach: avoid highlighting already highlighted text
    if (
      !highlightedText
        .toLowerCase()
        .includes(`<span class="highlight">${term.toLowerCase()}</span>`)
    ) {
      const regex = new RegExp(`(${escapeRegExp(term)})`, "gi");
      highlightedText = highlightedText.replace(
        regex,
        '<span class="highlight">$1</span>'
      );
    }
  });

  return highlightedText;
}

// Escape special characters for regex
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Create diagnosis card HTML
function createDiagnosisCard(diagnosis) {
  const query = searchInput.value;

  // Determine card type for styling
  const getCardType = (diagnosisName) => {
    const name = diagnosisName.toLowerCase();
    if (name.startsWith("risk for")) return "risk";
    if (name.startsWith("readiness for enhanced")) return "readiness";
    return "actual";
  };

  const cardType = getCardType(diagnosis.diagnosis);

  // Helper function to create compact sections
  const createCompactSection = (title, content) => {
    if (!content || content.length === 0) return "";
    const text = Array.isArray(content) ? content.join(", ") : content;
    return `
      <div class="section">
        <div class="section-title">${title}</div>
        <div class="section-content-text">${highlightSearchTerms(
          text,
          query
        )}</div>
      </div>
    `;
  };

  return `
    <div class="diagnosis-card diagnosis-card--${cardType}">
      <div class="diagnosis-title">
        <span class="diagnosis-text">${highlightSearchTerms(
          diagnosis.diagnosis,
          query
        )}</span>
        <span class="page-number">Page ${diagnosis.page_num}</span>
      </div>
      
      ${
        diagnosis.definition
          ? `
        <div class="definition">
          ${highlightSearchTerms(diagnosis.definition, query)}
        </div>
      `
          : ""
      }
      
      ${createCompactSection(
        "Characteristics",
        diagnosis.defining_characteristics
      )}
      ${createCompactSection("Related Factors", diagnosis.related_factors)}
      ${createCompactSection("Risk Factors", diagnosis.risk_factors)}
      ${createCompactSection(
        "Associated Conditions",
        diagnosis.associated_condition
      )}
      ${createCompactSection(
        "At Risk Population",
        diagnosis.at_risk_population
      )}
      ${createCompactSection("NOC Outcomes", diagnosis.suggested_noc_outcomes)}
      ${createCompactSection(
        "NIC Interventions",
        diagnosis.suggested_nic_interventions
      )}
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

  if (filteredData.length === 0) {
    noResults.style.display = "block";
    paginationContainer.style.display = "none";
    return;
  }

  // Sort results by diagnosis name
  const sortedData = [...filteredData].sort((a, b) =>
    a.diagnosis.localeCompare(b.diagnosis)
  );

  // Calculate start and end indices for current page
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, sortedData.length);
  const currentPageData = sortedData.slice(startIndex, endIndex);

  // Add loading state
  resultsContainer.style.opacity = "0.7";
  resultsContainer.style.transition = "opacity 0.3s ease";

  currentPageData.forEach((diagnosis, index) => {
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

// Update results count
function updateResultsCount(current, total) {
  if (current === total) {
    resultsCount.textContent = `Showing all ${total} diagnoses`;
  } else {
    resultsCount.textContent = `Showing ${current} of ${total} diagnoses`;
  }
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
  modalPageNumber.textContent = "Page " + diagnosis.page_num;
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
    diagnosis.defining_characteristics
  );
  sectionsHTML += createModalSection(
    "Related Factors",
    diagnosis.related_factors
  );
  sectionsHTML += createModalSection("Risk Factors", diagnosis.risk_factors);
  sectionsHTML += createModalSection(
    "Associated Conditions",
    diagnosis.associated_condition
  );
  sectionsHTML += createModalSection(
    "At Risk Population",
    diagnosis.at_risk_population
  );
  sectionsHTML += createModalSection(
    "NOC Outcomes",
    diagnosis.suggested_noc_outcomes
  );
  sectionsHTML += createModalSection(
    "NIC Interventions",
    diagnosis.suggested_nic_interventions
  );

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
