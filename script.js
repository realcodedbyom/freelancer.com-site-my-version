// Set current year in footer
document.getElementById("current-year").textContent = new Date().getFullYear()

// Update navigation based on login status
function updateNavigation() {
  const user = JSON.parse(localStorage.getItem('user'));
  const navLinks = document.querySelector('.nav-links');
  
  if (!navLinks) return;

  if (user) {
    const dashboardLink = user.userType === 'freelancer' ? 'freelancer-dashboard.html' : 'client-dashboard.html';
    const browseLink = user.userType === 'freelancer' ? 'browse-jobs.html' : 'browse-freelancers.html';
    const browseText = user.userType === 'freelancer' ? 'Browse Jobs' : 'Browse Freelancers';
    
    navLinks.innerHTML = `
      <li><a href="index.html">Home</a></li>
      <li><a href="${browseLink}">${browseText}</a></li>
      ${user.userType === 'client' ? '<li><a href="post-job.html">Post a Job</a></li>' : '<li><a href="my-applications.html">My Applications</a></li>'}
      <li><a href="messages.html">💬 Messages</a></li>
      <li><a href="${dashboardLink}">Dashboard</a></li>
      <li><a href="#" onclick="logout(); return false;" class="btn-login-nav">Logout</a></li>
    `;
  }
}

function logout() {
  localStorage.removeItem('user');
  window.location.href = 'index.html';
}

updateNavigation();

// Scroll to top functionality
const scrollTopButton = document.getElementById("scrollToTop")

window.addEventListener("scroll", () => {
  if (window.pageYOffset > 300) {
    scrollTopButton.classList.add("visible")
  } else {
    scrollTopButton.classList.remove("visible")
  }
})

scrollTopButton.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  })
})

// Navigation functionality
const navbar = document.getElementById("navbar")
const mobileMenuBtn = document.querySelector(".mobile-menu-btn")
const navLinks = document.querySelector(".nav-links")

window.addEventListener("scroll", () => {
  if (window.pageYOffset > 50) {
    navbar.classList.add("scrolled")
  } else {
    navbar.classList.remove("scrolled")
  }
})

mobileMenuBtn.addEventListener("click", () => {
  navLinks.classList.toggle("active")
})

// Close mobile menu when clicking a link
document.querySelectorAll(".nav-links a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("active")
  })
})

// Close mobile menu when clicking outside
document.addEventListener("click", (e) => {
  if (!e.target.closest(".nav-container")) {
    navLinks.classList.remove("active")
  }
})

// Animate skill bars on skills page
if (document.querySelector(".skills-proficiency")) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const progressBars = document.querySelectorAll(".proficiency-progress")
          progressBars.forEach((bar) => {
            const width = bar.style.width
            bar.style.width = "0"
            setTimeout(() => {
              bar.style.width = width
            }, 100)
          })
          observer.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.1 },
  )

  observer.observe(document.querySelector(".skills-proficiency"))
}

// Add animation to timeline items
if (document.querySelector(".timeline")) {
  const timelineObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1"
          entry.target.style.transform = "translateY(0)"
        }
      })
    },
    { threshold: 0.1 },
  )

  document.querySelectorAll(".timeline-item").forEach((item) => {
    item.style.opacity = "0"
    item.style.transform = "translateY(40px)"
    item.style.transition = "opacity 0.5s ease, transform 0.5s ease"
    timelineObserver.observe(item)
  })
}

// Add animation to service cards
if (document.querySelector(".services-grid")) {
  const serviceObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1"
          entry.target.style.transform = "translateY(0)"
        }
      })
    },
    { threshold: 0.1 },
  )

  document.querySelectorAll(".service-card").forEach((card, index) => {
    card.style.opacity = "0"
    card.style.transform = "translateY(40px)"
    card.style.transition = "opacity 0.5s ease, transform 0.5s ease"
    card.style.transitionDelay = `${index * 0.1}s`
    serviceObserver.observe(card)
  })
}

// Add animation to achievement cards
if (document.querySelector(".achievements-grid")) {
  const achievementObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1"
          entry.target.style.transform = "translateY(0)"
        }
      })
    },
    { threshold: 0.1 },
  )

  document.querySelectorAll(".achievement-card").forEach((card, index) => {
    card.style.opacity = "0"
    card.style.transform = "translateY(40px)"
    card.style.transition = "opacity 0.5s ease, transform 0.5s ease"
    card.style.transitionDelay = `${index * 0.1}s`
    achievementObserver.observe(card)
  })
}

// Add animation to project cards
if (document.querySelector(".project-card")) {
  const projectObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1"
          entry.target.style.transform = "translateY(0)"
        }
      })
    },
    { threshold: 0.1 },
  )

  document.querySelectorAll(".project-card").forEach((card, index) => {
    card.style.opacity = "0"
    card.style.transform = "translateY(40px)"
    card.style.transition = "opacity 0.5s ease, transform 0.5s ease"
    card.style.transitionDelay = `${index * 0.1}s`
    projectObserver.observe(card)
  })
}

if (document.getElementById("contactForm")) {
  const contactForm = document.getElementById("contactForm")
  const formMessage = document.getElementById("formMessage")

  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault()

    const name = document.getElementById("name").value
    const email = document.getElementById("email").value
    const subject = document.getElementById("subject").value
    const message = document.getElementById("message").value

    // Show loading state
    const submitBtn = contactForm.querySelector(".submit-btn")
    const originalText = submitBtn.textContent
    submitBtn.textContent = "Sending..."
    submitBtn.disabled = true

    try {
      const response = await fetch("/api/send-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          subject,
          message,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        formMessage.textContent = "Message sent successfully! I'll get back to you soon."
        formMessage.className = "form-message success"
        contactForm.reset()
      } else {
        formMessage.textContent = data.error || "Failed to send message. Please try again."
        formMessage.className = "form-message error"
      }
    } catch (error) {
      console.error("Error:", error)
      formMessage.textContent = "An error occurred. Please try again later."
      formMessage.className = "form-message error"
    } finally {
      submitBtn.textContent = originalText
      submitBtn.disabled = false
    }
  })
}
