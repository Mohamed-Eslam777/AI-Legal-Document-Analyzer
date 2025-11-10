// Legal Document Simplifier - Main JavaScript

// ===============================================
//               Utility: Debounce Function
// ===============================================
const debounce = (func, delay) => {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
};

// Initialize AOS (Animate On Scroll)
document.addEventListener('DOMContentLoaded', function() {
    AOS.init({
        duration: 800,
        easing: 'ease-in-out',
        once: true,
        offset: 100
    });
});

// Form handling
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('simplify-form');
    const resultsDiv = document.getElementById('results');
    const submitButton = form.querySelector('button[type="submit"]');
    const submitButtonText = document.getElementById('submit-button-text');
    const originalButtonText = submitButton.innerHTML;
    const legalText1 = document.getElementById('legal_text_1');
    const legalText2 = document.getElementById('legal_text_2');
    
    // Update button text based on whether second document is filled
    function updateButtonText() {
        if (legalText2 && legalText2.value.trim().length > 0) {
            submitButtonText.textContent = 'Compare Documents';
            submitButton.querySelector('i').className = 'fas fa-balance-scale';
        } else {
            submitButtonText.textContent = 'Analyze Document';
            submitButton.querySelector('i').className = 'fas fa-magic';
        }
    }
    
    // Listen for changes in second textarea
    if (legalText2) {
        legalText2.addEventListener('input', updateButtonText);
        legalText2.addEventListener('paste', function() {
            setTimeout(updateButtonText, 100);
        });
    }
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const legalText1Value = formData.get('legal_text_1').trim();
        const legalText2Value = formData.get('legal_text_2') ? formData.get('legal_text_2').trim() : '';
        const isComparisonMode = legalText2Value.length > 0;
        
        // Validate input
        if (!legalText1Value) {
            resultsDiv.innerHTML = '<p style="color: #e74c3c;"><i class="fas fa-exclamation-circle"></i> Please provide at least one document text to analyze.</p>';
            resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
        }
        
        // Show loading state
        submitButton.disabled = true;
        const loadingText = isComparisonMode ? 'Comparing documents...' : 'Analyzing document...';
        submitButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
        resultsDiv.innerHTML = `<div class="loading"><p style="text-align: center; color: #667eea;"><i class="fas fa-spinner fa-spin"></i> ${loadingText}</p></div>`;
        resultsDiv.style.color = '#666';
        
        // Scroll to results
        resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        try {
            const response = await fetch('/simplify', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                let html = '';
                const analysis = data.analysis || {};
                const mode = data.mode || (isComparisonMode ? 'comparison' : 'simplification');
                
                if (mode === 'comparison') {
                    // Display Comparison Results
                    html += '<div class="comparison-section" data-aos="fade-up">';
                    html += '<h3><i class="fas fa-balance-scale"></i> مقارنة المستندات (Document Comparison)</h3>';
                    
                    // Display Differences
                    if (analysis.differences && analysis.differences.length > 0) {
                        html += '<div class="differences-section">';
                        html += '<h4><i class="fas fa-list-ul"></i> الاختلافات الرئيسية (Key Differences)</h4>';
                        analysis.differences.forEach((difference, index) => {
                            html += `<div class="difference-item" data-aos="fade-right" data-aos-delay="${index * 100}">`;
                            html += `<span class="item-number">${index + 1}.</span>${difference}`;
                            html += `</div>`;
                        });
                        html += '</div>';
                    }
                    
                    // Display Missing Clause
                    if (analysis.missing_clause) {
                        html += '<div class="missing-clause-section">';
                        html += '<h4><i class="fas fa-exclamation-circle"></i> البند المفقود (Missing Clause)</h4>';
                        html += `<div class="missing-clause-item" data-aos="fade-up">`;
                        html += `<p>${analysis.missing_clause}</p>`;
                        html += `</div>`;
                        html += '</div>';
                    }
                    
                    html += '</div>';
                } else {
                    // Display Simplification Results (Original Logic)
                    // Display Obligations
                    if (analysis.obligations && analysis.obligations.length > 0) {
                        html += '<div class="obligations-section" data-aos="fade-up">';
                        html += '<h3><i class="fas fa-check-circle"></i> الالتزامات (Obligations)</h3>';
                        analysis.obligations.forEach((obligation, index) => {
                            html += `<div class="obligation-item" data-aos="fade-right" data-aos-delay="${index * 100}">`;
                            html += `<span class="item-number">${index + 1}.</span>${obligation}`;
                            html += `</div>`;
                        });
                        html += '</div>';
                    }
                    
                    // Display Risks
                    if (analysis.risks && analysis.risks.length > 0) {
                        html += '<div class="risks-section" data-aos="fade-up">';
                        html += '<h3><i class="fas fa-exclamation-triangle"></i> المخاطر (Risks)</h3>';
                        analysis.risks.forEach((risk, index) => {
                            html += `<div class="risk-item" data-aos="fade-right" data-aos-delay="${index * 100}">`;
                            html += `<span class="item-number">${index + 1}.</span>${risk}`;
                            html += `</div>`;
                        });
                        html += '</div>';
                    }
                }
                
                if (html === '') {
                    html = '<p style="text-align: center; color: #7f8c8d;"><i class="fas fa-info-circle"></i> No results found.</p>';
                    // Hide export button when no results
                    const resultsSection = document.getElementById('results-section');
                    if (resultsSection) {
                        resultsSection.style.display = 'none';
                    }
                } else {
                    // Show export button when results are displayed
                    const resultsSection = document.getElementById('results-section');
                    if (resultsSection) {
                        resultsSection.style.display = 'block';
                    }
                }
                
                resultsDiv.innerHTML = html;
                resultsDiv.style.color = '#333';
                
                // Re-initialize AOS for dynamically added content
                AOS.refresh();
            } else {
                // Display error message
                const errorMsg = data.message || data.error || 'Unknown error occurred';
                resultsDiv.innerHTML = `<p style="color: #e74c3c;"><i class="fas fa-times-circle"></i> Error: ${errorMsg}</p>`;
                resultsDiv.style.color = '#dc3545';
                
                // Hide export button on error
                const resultsSection = document.getElementById('results-section');
                if (resultsSection) {
                    resultsSection.style.display = 'none';
                }
            }
        } catch (error) {
            resultsDiv.innerHTML = `<p style="color: #e74c3c;"><i class="fas fa-exclamation-triangle"></i> Error: ${error.message}</p>`;
            resultsDiv.style.color = '#dc3545';
            
            // Hide export button on error
            const resultsSection = document.getElementById('results-section');
            if (resultsSection) {
                resultsSection.style.display = 'none';
            }
        } finally {
            // Re-enable button
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
            updateButtonText();
        }
    });
});

// Add smooth scroll behavior for better UX
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ===============================================
//              Assessment Logic (New)
// ===============================================

const assessDocument = async (text) => {
    const badge = document.getElementById('assessment-result-badge');
    const typeSpan = document.getElementById('document-type-span');
    
    if (!badge || !typeSpan) return;

    // Show loading state while typing
    typeSpan.textContent = 'Analyzing...';
    badge.style.display = 'block';
    badge.className = 'assessment-badge assessment-info';

    if (text.length < 100) {
        typeSpan.textContent = 'Awaiting sufficient input...';
        badge.className = 'assessment-badge assessment-warning';
        return;
    }

    try {
        const formData = new FormData();
        formData.append('text', text);

        const response = await fetch('/assess', {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        if (data.success && data.valid) {
            typeSpan.textContent = data.type;
            badge.className = 'assessment-badge assessment-success';
        } else if (data.success && !data.valid) {
             typeSpan.textContent = `General Text (Not Legal)`;
             badge.className = 'assessment-badge assessment-warning';
        } else {
            typeSpan.textContent = 'Analysis Failed';
            badge.className = 'assessment-badge assessment-danger';
        }

    } catch (error) {
        typeSpan.textContent = 'Server Error during assessment.';
        badge.className = 'assessment-badge assessment-danger';
    }
};

// Use debounce for the assessment function (wait 1 second after typing stops)
const debouncedAssess = debounce(assessDocument, 1000);

// Add loading state to textarea when typing and attach assessment
document.addEventListener('DOMContentLoaded', function() {
    const textarea1 = document.getElementById('legal_text_1');
    const textarea2 = document.getElementById('legal_text_2');
    
    // Function to add visual feedback and assessment to textarea
    function setupTextarea(textarea) {
        if (!textarea) return;
        
        // Visual feedback on input
        textarea.addEventListener('input', function() {
            if (this.value.trim().length > 0) {
                this.style.borderColor = '#667eea';
            } else {
                this.style.borderColor = '#e0e0e0';
            }
        });
        
        // Attach assessment function to first textarea only
        if (textarea.id === 'legal_text_1') {
            textarea.addEventListener('keyup', (e) => {
                debouncedAssess(e.target.value);
            });
            
            textarea.addEventListener('paste', (e) => {
                // Wait for paste to complete, then trigger assessment
                setTimeout(() => {
                    debouncedAssess(e.target.value);
                }, 100);
            });
        }
    }
    
    // Setup both textareas
    setupTextarea(textarea1);
    setupTextarea(textarea2);
    
    // Setup export button
    setupExportButton();
});

// ===============================================
//              Export/Print Logic
// ===============================================

const setupExportButton = () => {
    const exportBtn = document.getElementById('export-report-btn');
    if (!exportBtn) return;

    exportBtn.addEventListener('click', () => {
        // This triggers the browser's Print dialog, which can save as PDF
        window.print();
    });
};

