const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const uri = "mongodb+srv://om3479781:omkumar@freelance.duui2y.mongodb.net/?appName=freelance";
const client = new MongoClient(uri);

let db;

// Connect to MongoDB at startup
async function connectDB() {
  try {
    await client.connect();
    db = client.db('freelance');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

connectDB();

// Simple admin helper for admin-only endpoints
async function getAdminUser(req) {
  try {
    const adminId =
      req.header('x-admin-id') ||
      (req.query && req.query.adminId) ||
      (req.body && req.body.adminId);
    if (!adminId) return null;

    const users = db.collection('users');
    const admin = await users.findOne({
      _id: new ObjectId(adminId),
      userType: 'admin'
    });
    return admin || null;
  } catch (err) {
    console.error('Error resolving admin user:', err);
    return null;
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ============ AUTH ENDPOINTS ============

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const users = db.collection('users');
    const user = await users.findOne({ email });

    if (!user || user.password !== password) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const { password: _, ...userWithoutPassword } = user;

    return res.status(200).json({
      success: true,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name, username, userType } = req.body;

    if (!email || !password || !name || !username || !userType) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    const users = db.collection('users');
    
    // Check email
    const existingEmail = await users.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email already exists'
      });
    }

    // Check username
    const existingUsername = await users.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        error: 'Username already taken'
      });
    }

    const newUser = {
      email,
      password,
      name,
      username: username.toLowerCase(),
      userType,
      createdAt: new Date()
    };

    // Add freelancer profile if userType is freelancer
    if (userType === 'freelancer') {
      newUser.freelancerProfile = {
        title: '',
        bio: '',
        skills: [],
        hourlyRate: 0,
        rating: 0,
        reviewCount: 0,
        isAvailable: true
      };
    }

    const result = await users.insertOne(newUser);
    const { password: _, ...userWithoutPassword } = newUser;
    userWithoutPassword._id = result.insertedId;

    return res.status(200).json({
      success: true,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Signup failed. Please try again.'
    });
  }
});

// ============ JOBS ENDPOINTS ============

app.post('/api/jobs', async (req, res) => {
  try {
    const jobData = req.body;
    const jobs = db.collection('jobs');
    
    const newJob = {
      ...jobData,
      clientId: new ObjectId(jobData.clientId),
      status: 'open',
      createdAt: new Date()
    };

    const result = await jobs.insertOne(newJob);
    newJob._id = result.insertedId;

    return res.status(200).json({
      success: true,
      job: newJob
    });
  } catch (error) {
    console.error('Error creating job:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create job'
    });
  }
});

app.get('/api/jobs', async (req, res) => {
  try {
    const { category, minBudget, maxBudget, experience } = req.query;
    const jobs = db.collection('jobs');
    
    let query = {};
    if (category) query.category = category;
    if (experience) query.experience = experience;
    if (minBudget || maxBudget) {
      query.budget = {};
      if (minBudget) query.budget.$gte = parseFloat(minBudget);
      if (maxBudget) query.budget.$lte = parseFloat(maxBudget);
    }

    const jobsList = await jobs.find(query).toArray();

    // Get client names
    const users = db.collection('users');
    for (let job of jobsList) {
      const client = await users.findOne({ _id: job.clientId });
      job.clientName = client ? client.name : 'Unknown';
    }

    return res.status(200).json({
      success: true,
      jobs: jobsList
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch jobs'
    });
  }
});

app.get('/api/jobs/:id', async (req, res) => {
  try {
    const jobs = db.collection('jobs');
    const job = await jobs.findOne({ _id: new ObjectId(req.params.id) });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // Get client name
    const users = db.collection('users');
    const client = await users.findOne({ _id: job.clientId });
    job.clientName = client ? client.name : 'Unknown';

    // Get applications count
    const applications = db.collection('applications');
    job.applicationsCount = await applications.countDocuments({ jobId: job._id });

    return res.status(200).json({
      success: true,
      job
    });
  } catch (error) {
    console.error('Error fetching job:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch job'
    });
  }
});

app.post('/api/jobs/:id/apply', async (req, res) => {
  try {
    const { freelancerId, coverLetter } = req.body;
    const jobId = new ObjectId(req.params.id);

    const applications = db.collection('applications');
    
    // Check if already applied
    const existing = await applications.findOne({
      jobId,
      freelancerId: new ObjectId(freelancerId)
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Already applied to this job'
      });
    }

    const newApplication = {
      jobId,
      freelancerId: new ObjectId(freelancerId),
      status: 'pending',
      coverLetter: coverLetter || '',
      appliedAt: new Date()
    };

    const result = await applications.insertOne(newApplication);
    newApplication._id = result.insertedId;

    return res.status(200).json({
      success: true,
      application: newApplication
    });
  } catch (error) {
    console.error('Error applying to job:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to apply to job'
    });
  }
});

// ============ FREELANCERS ENDPOINTS ============

app.get('/api/freelancers', async (req, res) => {
  try {
    const { skill, minRate, maxRate, minRating } = req.query;
    const users = db.collection('users');
    
    let query = { userType: 'freelancer' };
    
    if (skill) {
      query['freelancerProfile.skills'] = skill;
    }
    if (minRate || maxRate) {
      query['freelancerProfile.hourlyRate'] = {};
      if (minRate) query['freelancerProfile.hourlyRate'].$gte = parseFloat(minRate);
      if (maxRate) query['freelancerProfile.hourlyRate'].$lte = parseFloat(maxRate);
    }
    if (minRating) {
      query['freelancerProfile.rating'] = { $gte: parseFloat(minRating) };
    }

    const freelancers = await users.find(query).toArray();

    // Remove passwords
    const sanitized = freelancers.map(f => {
      const { password, ...rest } = f;
      return rest;
    });

    return res.status(200).json({
      success: true,
      freelancers: sanitized
    });
  } catch (error) {
    console.error('Error fetching freelancers:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch freelancers'
    });
  }
});

// Fair, rotating "Featured Freelancers" so everyone gets a chance
app.get('/api/featured-freelancers', async (req, res) => {
  try {
    const users = db.collection('users');

    // Every freelancer is eligible; we just take a random sample each time
    const pipeline = [
      { $match: { userType: 'freelancer' } },
      { $sample: { size: 6 } } // up to 6 random featured freelancers
    ];

    const freelancers = await users.aggregate(pipeline).toArray();

    const sanitized = freelancers.map(f => {
      const { password, ...rest } = f;
      return rest;
    });

    return res.status(200).json({
      success: true,
      freelancers: sanitized
    });
  } catch (error) {
    console.error('Error fetching featured freelancers:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch featured freelancers'
    });
  }
});

// Monthly leaderboard based on rating and jobs done (completed / hired in last 30 days)
app.get('/api/freelancers/leaderboard', async (req, res) => {
  try {
    const users = db.collection('users');

    const since = new Date();
    since.setDate(since.getDate() - 30); // last 30 days

    const pipeline = [
      { $match: { userType: 'freelancer' } },
      {
        $lookup: {
          from: 'applications',
          let: { freelancerId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$freelancerId', '$$freelancerId'] },
                    { $in: ['$status', ['completed', 'hired']] },
                    { $gte: ['$appliedAt', since] }
                  ]
                }
              }
            }
          ],
          as: 'recentApps'
        }
      },
      {
        $addFields: {
          jobsDoneThisMonth: { $size: '$recentApps' }
        }
      },
      {
        $project: {
          password: 0,
          recentApps: 0
        }
      },
      {
        $sort: {
          'freelancerProfile.rating': -1,
          jobsDoneThisMonth: -1,
          'freelancerProfile.reviewCount': -1
        }
      },
      { $limit: 10 }
    ];

    const leaderboard = await users.aggregate(pipeline).toArray();

    return res.status(200).json({
      success: true,
      freelancers: leaderboard
    });
  } catch (error) {
    console.error('Error fetching freelancers leaderboard:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard'
    });
  }
});

app.get('/api/freelancers/:id', async (req, res) => {
  try {
    const users = db.collection('users');
    const freelancer = await users.findOne({
      _id: new ObjectId(req.params.id),
      userType: 'freelancer'
    });

    if (!freelancer) {
      return res.status(404).json({
        success: false,
        error: 'Freelancer not found'
      });
    }

    const { password, ...sanitized } = freelancer;

    return res.status(200).json({
      success: true,
      freelancer: sanitized
    });
  } catch (error) {
    console.error('Error fetching freelancer:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch freelancer'
    });
  }
});

app.put('/api/freelancers/:id', async (req, res) => {
  try {
    const updates = req.body;
    const users = db.collection('users');

    const result = await users.updateOne(
      { _id: new ObjectId(req.params.id), userType: 'freelancer' },
      { $set: { freelancerProfile: updates.freelancerProfile } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Freelancer not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Error updating freelancer:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

// ============ RATINGS ENDPOINTS ============

// Client rates a freelancer (1-5 stars + optional review)
app.post('/api/freelancers/:id/rate', async (req, res) => {
  try {
    const { clientId, rating, review } = req.body;

    if (!clientId || typeof rating !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'clientId and numeric rating are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }

    const users = db.collection('users');
    const ratings = db.collection('ratings');

    const freelancerId = new ObjectId(req.params.id);
    const clientOid = new ObjectId(clientId);

    const freelancer = await users.findOne({
      _id: freelancerId,
      userType: 'freelancer'
    });
    if (!freelancer) {
      return res.status(404).json({
        success: false,
        error: 'Freelancer not found'
      });
    }

    const client = await users.findOne({
      _id: clientOid,
      userType: 'client'
    });
    if (!client) {
      return res.status(400).json({
        success: false,
        error: 'Only clients can leave ratings'
      });
    }

    // One rating per client per freelancer; later ratings overwrite older ones
    await ratings.updateOne(
      { freelancerId, clientId: clientOid },
      {
        $set: {
          freelancerId,
          clientId: clientOid,
          rating,
          review: review || '',
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    // Recalculate average rating + review count
    const stats = await ratings
      .aggregate([
        { $match: { freelancerId } },
        {
          $group: {
            _id: '$freelancerId',
            avgRating: { $avg: '$rating' },
            reviewCount: { $sum: 1 }
          }
        }
      ])
      .toArray();

    let avgRating = 0;
    let reviewCount = 0;
    if (stats.length > 0) {
      avgRating = parseFloat(stats[0].avgRating.toFixed(2));
      reviewCount = stats[0].reviewCount;
    }

    await users.updateOne(
      { _id: freelancerId },
      {
        $set: {
          'freelancerProfile.rating': avgRating,
          'freelancerProfile.reviewCount': reviewCount
        }
      }
    );

    return res.status(200).json({
      success: true,
      rating: avgRating,
      reviewCount
    });
  } catch (error) {
    console.error('Error rating freelancer:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to submit rating'
    });
  }
});

// Public reviews for a freelancer
app.get('/api/freelancers/:id/reviews', async (req, res) => {
  try {
    const ratings = db.collection('ratings');
    const users = db.collection('users');

    const freelancerId = new ObjectId(req.params.id);

    const list = await ratings
      .find({ freelancerId })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    for (let r of list) {
      const client = await users.findOne(
        { _id: r.clientId },
        { projection: { name: 1, username: 1 } }
      );
      r.clientName = client ? client.name : 'Client';
      r.clientUsername = client && client.username ? client.username : null;
    }

    return res.status(200).json({
      success: true,
      reviews: list
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch reviews'
    });
  }
});

// ============ APPLICATIONS ENDPOINTS ============

app.get('/api/applications/client/:userId', async (req, res) => {
  try {
    const jobs = db.collection('jobs');
    const applications = db.collection('applications');
    const users = db.collection('users');

    // Get client's jobs
    const clientJobs = await jobs.find({
      clientId: new ObjectId(req.params.userId)
    }).toArray();

    const jobIds = clientJobs.map(j => j._id);

    // Get applications for those jobs
    const apps = await applications.find({
      jobId: { $in: jobIds }
    }).toArray();

    // Enrich with freelancer and job data
    for (let app of apps) {
      const freelancer = await users.findOne({ _id: app.freelancerId });
      const job = clientJobs.find(j => j._id.equals(app.jobId));
      
      app.freelancerName = freelancer ? freelancer.name : 'Unknown';
      app.jobTitle = job ? job.title : 'Unknown';
      app.jobBudget = job ? job.budget : 0;
    }

    return res.status(200).json({
      success: true,
      applications: apps
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch applications'
    });
  }
});

app.get('/api/applications/freelancer/:userId', async (req, res) => {
  try {
    const applications = db.collection('applications');
    const jobs = db.collection('jobs');
    const users = db.collection('users');

    const apps = await applications.find({
      freelancerId: new ObjectId(req.params.userId)
    }).toArray();

    // Enrich with job and client data
    for (let app of apps) {
      const job = await jobs.findOne({ _id: app.jobId });
      if (job) {
        const client = await users.findOne({ _id: job.clientId });
        app.jobTitle = job.title;
        app.jobCategory = job.category;
        app.budget = job.budget;
        app.clientName = client ? client.name : 'Unknown';
      }
    }

    return res.status(200).json({
      success: true,
      applications: apps
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch applications'
    });
  }
});

app.put('/api/applications/:id/hire', async (req, res) => {
  try {
    const applications = db.collection('applications');
    const jobs = db.collection('jobs');

    const app = await applications.findOne({ _id: new ObjectId(req.params.id) });
    if (!app) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    // Update application status
    await applications.updateOne(
      { _id: app._id },
      { $set: { status: 'hired' } }
    );

    // Update job status
    await jobs.updateOne(
      { _id: app.jobId },
      { $set: { status: 'in-progress' } }
    );

    return res.status(200).json({
      success: true,
      message: 'Freelancer hired successfully'
    });
  } catch (error) {
    console.error('Error hiring freelancer:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to hire freelancer'
    });
  }
});

app.put('/api/applications/:id/reject', async (req, res) => {
  try {
    const applications = db.collection('applications');

    const result = await applications.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: 'rejected' } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Application rejected'
    });
  } catch (error) {
    console.error('Error rejecting application:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reject application'
    });
  }
});

app.put('/api/applications/:id/accept', async (req, res) => {
  try {
    const applications = db.collection('applications');

    const result = await applications.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: 'accepted' } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Offer accepted'
    });
  } catch (error) {
    console.error('Error accepting offer:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to accept offer'
    });
  }
});

app.put('/api/applications/:id/decline', async (req, res) => {
  try {
    const applications = db.collection('applications');
    const jobs = db.collection('jobs');

    const app = await applications.findOne({ _id: new ObjectId(req.params.id) });
    if (!app) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    // Update application status
    await applications.updateOne(
      { _id: app._id },
      { $set: { status: 'declined' } }
    );

    // Set job back to open
    await jobs.updateOne(
      { _id: app.jobId },
      { $set: { status: 'open' } }
    );

    return res.status(200).json({
      success: true,
      message: 'Offer declined'
    });
  } catch (error) {
    console.error('Error declining offer:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to decline offer'
    });
  }
});

// ============ JOB COMPLETION ENDPOINT ============

app.put('/api/jobs/:id/complete', async (req, res) => {
  try {
    const jobId = new ObjectId(req.params.id);
    const jobs = db.collection('jobs');
    const applications = db.collection('applications');

    const job = await jobs.findOne({ _id: jobId });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    await jobs.updateOne({ _id: jobId }, { $set: { status: 'completed', completedAt: new Date() } });

    // Update hired application, if any, to completed
    await applications.updateMany({ jobId, status: 'hired' }, { $set: { status: 'completed' } });

    return res.status(200).json({ success: true, message: 'Job marked as completed' });
  } catch (error) {
    console.error('Error completing job:', error);
    return res.status(500).json({ success: false, error: 'Failed to complete job' });
  }
});

// ============ USERS ENDPOINT ============

app.get('/api/users', async (req, res) => {
  try {
    const users = db.collection('users');
    const { excludeId, search } = req.query;
    
    let query = {};
    if (excludeId) {
      query._id = { $ne: new ObjectId(excludeId) };
    }

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    const usersList = await users.find(query).limit(50).toArray();
    
    // Remove passwords
    const sanitized = usersList.map(u => {
      const { password, ...rest } = u;
      return rest;
    });

    return res.status(200).json({
      success: true,
      users: sanitized
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

app.get('/api/users/username/:username', async (req, res) => {
  try {
    const users = db.collection('users');
    const user = await users.findOne({ username: req.params.username.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const { password, ...sanitized } = user;

    return res.status(200).json({
      success: true,
      user: sanitized
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
});

// ============ INTEREST / MATCHING ENDPOINTS ============

// Client shows interest in a freelancer (Tinder-style "like")
app.post('/api/interests', async (req, res) => {
  try {
    const { fromUserId, toUserId } = req.body;

    if (!fromUserId || !toUserId) {
      return res.status(400).json({
        success: false,
        error: 'fromUserId and toUserId are required'
      });
    }

    const users = db.collection('users');
    const interests = db.collection('interests');

    const fromUser = await users.findOne({ _id: new ObjectId(fromUserId) });
    const toUser = await users.findOne({ _id: new ObjectId(toUserId) });

    if (!fromUser || !toUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Only allow client → freelancer interest for now
    if (fromUser.userType !== 'client' || toUser.userType !== 'freelancer') {
      return res.status(400).json({
        success: false,
        error: 'Only clients can show interest in freelancers'
      });
    }

    const existing = await interests.findOne({
      fromUserId: new ObjectId(fromUserId),
      toUserId: new ObjectId(toUserId)
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        interest: existing
      });
    }

    const newInterest = {
      fromUserId: new ObjectId(fromUserId),
      toUserId: new ObjectId(toUserId),
      status: 'pending', // pending → accepted / rejected
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await interests.insertOne(newInterest);
    newInterest._id = result.insertedId;

    return res.status(200).json({
      success: true,
      interest: newInterest
    });
  } catch (error) {
    console.error('Error creating interest:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create interest'
    });
  }
});

// Freelancer sees all interest requests sent to them
app.get('/api/interests/freelancer/:userId', async (req, res) => {
  try {
    const interests = db.collection('interests');
    const users = db.collection('users');
    const freelancerId = new ObjectId(req.params.userId);

    const list = await interests.find({ toUserId: freelancerId }).toArray();

    // Enrich with client data
    for (let interest of list) {
      const client = await users.findOne({ _id: interest.fromUserId });
      if (client) {
        const { password, ...sanitizedClient } = client;
        interest.client = sanitizedClient;
      }
    }

    return res.status(200).json({
      success: true,
      interests: list
    });
  } catch (error) {
    console.error('Error fetching freelancer interests:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch interests'
    });
  }
});

// Client can see all interests they have sent
app.get('/api/interests/client/:userId', async (req, res) => {
  try {
    const interests = db.collection('interests');
    const users = db.collection('users');
    const clientId = new ObjectId(req.params.userId);

    const list = await interests.find({ fromUserId: clientId }).toArray();

    // Enrich with freelancer data
    for (let interest of list) {
      const freelancer = await users.findOne({ _id: interest.toUserId });
      if (freelancer) {
        const { password, ...sanitizedFreelancer } = freelancer;
        interest.freelancer = sanitizedFreelancer;
      }
    }

    return res.status(200).json({
      success: true,
      interests: list
    });
  } catch (error) {
    console.error('Error fetching client interests:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch interests'
    });
  }
});

// Freelancer accepts interest → becomes a match and unlocks chat
app.put('/api/interests/:id/accept', async (req, res) => {
  try {
    const interests = db.collection('interests');
    const conversations = db.collection('conversations');

    const interest = await interests.findOne({ _id: new ObjectId(req.params.id) });
    if (!interest) {
      return res.status(404).json({
        success: false,
        error: 'Interest not found'
      });
    }

    await interests.updateOne(
      { _id: interest._id },
      { $set: { status: 'accepted', updatedAt: new Date() } }
    );

    // Auto-create empty conversation so chat list is populated
    const existingConv = await conversations.findOne({
      participants: { $all: [interest.fromUserId, interest.toUserId] }
    });

    if (!existingConv) {
      await conversations.insertOne({
        participants: [interest.fromUserId, interest.toUserId],
        messages: [],
        createdAt: new Date()
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Interest accepted – match created'
    });
  } catch (error) {
    console.error('Error accepting interest:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to accept interest'
    });
  }
});

// Freelancer rejects interest
app.put('/api/interests/:id/reject', async (req, res) => {
  try {
    const interests = db.collection('interests');

    const interest = await interests.findOne({ _id: new ObjectId(req.params.id) });
    if (!interest) {
      return res.status(404).json({
        success: false,
        error: 'Interest not found'
      });
    }

    await interests.updateOne(
      { _id: interest._id },
      { $set: { status: 'rejected', updatedAt: new Date() } }
    );

    return res.status(200).json({
      success: true,
      message: 'Interest rejected'
    });
  } catch (error) {
    console.error('Error rejecting interest:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reject interest'
    });
  }
});

// Get matched users for a given user (accepted interests)
app.get('/api/matches/:userId', async (req, res) => {
  try {
    const interests = db.collection('interests');
    const users = db.collection('users');
    const userId = new ObjectId(req.params.userId);

    const accepted = await interests.find({
      status: 'accepted',
      $or: [{ fromUserId: userId }, { toUserId: userId }]
    }).toArray();

    const otherUserIds = [
      ...new Set(
        accepted.map(i =>
          i.fromUserId.equals(userId) ? i.toUserId.toString() : i.fromUserId.toString()
        )
      )
    ].map(id => new ObjectId(id));

    if (otherUserIds.length === 0) {
      return res.status(200).json({
        success: true,
        users: []
      });
    }

    const matchedUsers = await users.find({ _id: { $in: otherUserIds } }).toArray();
    const sanitized = matchedUsers.map(u => {
      const { password, ...rest } = u;
      return rest;
    });

    return res.status(200).json({
      success: true,
      users: sanitized
    });
  } catch (error) {
    console.error('Error fetching matches:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch matches'
    });
  }
});

// ============ MESSAGES ENDPOINTS ============

// Conversations are only meaningful between matched users,
// but we return any existing conversation documents for the user.
app.get('/api/conversations/:userId', async (req, res) => {
  try {
    const conversations = db.collection('conversations');
    const users = db.collection('users');

    const userId = new ObjectId(req.params.userId);
    const convs = await conversations.find({
      participants: userId
    }).toArray();

    // Get other participant names
    for (let conv of convs) {
      const otherUserId = conv.participants.find(p => !p.equals(userId));
      const otherUser = await users.findOne({ _id: otherUserId });
      conv.participantName = otherUser ? otherUser.name : 'Unknown';
      conv.lastMessage = conv.messages.length > 0 ? conv.messages[conv.messages.length - 1].text : '';
      conv.lastMessageTime = conv.messages.length > 0 ? conv.messages[conv.messages.length - 1].timestamp : conv.createdAt;
    }

    return res.status(200).json({
      success: true,
      conversations: convs
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations'
    });
  }
});

// Only allow sending messages between matched users
app.post('/api/messages', async (req, res) => {
  try {
    const { senderId, receiverId, text } = req.body;
    const conversations = db.collection('conversations');
    const interests = db.collection('interests');

    const senderOid = new ObjectId(senderId);
    const receiverOid = new ObjectId(receiverId);

    // Check if there is an accepted interest between these two users
    const match = await interests.findOne({
      status: 'accepted',
      $or: [
        { fromUserId: senderOid, toUserId: receiverOid },
        { fromUserId: receiverOid, toUserId: senderOid }
      ]
    });

    if (!match) {
      return res.status(403).json({
        success: false,
        error: 'Chat is only available after mutual interest (match)'
      });
    }

    // Find or create conversation
    let conversation = await conversations.findOne({
      participants: { $all: [senderOid, receiverOid] }
    });

    const message = {
      senderId: senderOid,
      text,
      timestamp: new Date()
    };

    if (conversation) {
      // Add message to existing conversation
      await conversations.updateOne(
        { _id: conversation._id },
        { $push: { messages: message } }
      );
    } else {
      // Create new conversation
      conversation = {
        participants: [senderOid, receiverOid],
        messages: [message],
        createdAt: new Date()
      };
      await conversations.insertOne(conversation);
    }

    return res.status(200).json({
      success: true,
      message: 'Message sent'
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
});

// ============ SEND MESSAGE (TELEGRAM) ============

app.post('/api/send-message', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const TELEGRAM_BOT_TOKEN = '7654029423:AAFS4Lu1PyaoOnP3475HNZbUT1SpBMhvE4E';
    const TELEGRAM_CHAT_ID = '2001901489';

    const telegramMessage = `
📧 New Contact Form Submission

👤 Name: ${name}
📨 Email: ${email}
📝 Subject: ${subject}

💬 Message:
${message}

---
Sent from Freelance Platform
    `.trim();

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: telegramMessage,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Telegram API error:', data);
      return res.status(500).json({ error: 'Failed to send message' });
    }

    return res.status(200).json({
      success: true,
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ REPORTS (USER → ADMIN) ============

// Any logged-in user can file a report about a user or job
app.post('/api/reports', async (req, res) => {
  try {
    const { reporterId, type, targetUserId, jobId, reason, details } = req.body;

    if (!reporterId || !type || !reason) {
      return res.status(400).json({
        success: false,
        error: 'reporterId, type and reason are required'
      });
    }

    if (!['user', 'job', 'other'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid report type'
      });
    }

    const users = db.collection('users');
    const jobs = db.collection('jobs');
    const reports = db.collection('reports');

    const reporterOid = new ObjectId(reporterId);
    const reporter = await users.findOne({ _id: reporterOid });
    if (!reporter) {
      return res.status(400).json({
        success: false,
        error: 'Reporter not found'
      });
    }

    let targetUserOid = null;
    let jobOid = null;

    if (type === 'user') {
      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          error: 'targetUserId is required for user reports'
        });
      }
      targetUserOid = new ObjectId(targetUserId);
      const targetUser = await users.findOne({ _id: targetUserOid });
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          error: 'Target user not found'
        });
      }
    }

    if (type === 'job') {
      if (!jobId) {
        return res.status(400).json({
          success: false,
          error: 'jobId is required for job reports'
        });
      }
      jobOid = new ObjectId(jobId);
      const job = await jobs.findOne({ _id: jobOid });
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }
    }

    const newReport = {
      reporterId: reporterOid,
      type,
      targetUserId: targetUserOid || null,
      jobId: jobOid || null,
      reason,
      details: details || '',
      status: 'open', // open → resolved / ignored
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await reports.insertOne(newReport);
    newReport._id = result.insertedId;

    return res.status(200).json({
      success: true,
      report: newReport
    });
  } catch (error) {
    console.error('Error creating report:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to submit report'
    });
  }
});

// Admin: list reports (default only open)
app.get('/api/admin/reports', async (req, res) => {
  try {
    const admin = await getAdminUser(req);
    if (!admin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const reports = db.collection('reports');
    const users = db.collection('users');
    const jobs = db.collection('jobs');

    const status = req.query.status || 'open';
    const query = status === 'all' ? {} : { status };

    const list = await reports
      .find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    for (let r of list) {
      if (r.reporterId) {
        const reporter = await users.findOne(
          { _id: r.reporterId },
          { projection: { name: 1, username: 1, userType: 1 } }
        );
        r.reporter = reporter || null;
      }

      if (r.targetUserId) {
        const targetUser = await users.findOne(
          { _id: r.targetUserId },
          { projection: { name: 1, username: 1, userType: 1 } }
        );
        r.targetUser = targetUser || null;
      }

      if (r.jobId) {
        const job = await jobs.findOne(
          { _id: r.jobId },
          { projection: { title: 1, status: 1 } }
        );
        r.job = job || null;
      }
    }

    return res.status(200).json({
      success: true,
      reports: list
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch reports'
    });
  }
});

// Admin: update report status / note
app.put('/api/admin/reports/:id', async (req, res) => {
  try {
    const admin = await getAdminUser(req);
    if (!admin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const { status, adminNote } = req.body;
    if (!status || !['open', 'resolved', 'ignored'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const reports = db.collection('reports');
    const reportId = new ObjectId(req.params.id);

    const update = {
      status,
      updatedAt: new Date(),
      resolvedByAdminId: admin._id
    };
    if (adminNote !== undefined) {
      update.adminNote = adminNote;
    }
    if (status === 'resolved' || status === 'ignored') {
      update.resolvedAt = new Date();
    }

    const result = await reports.updateOne(
      { _id: reportId },
      { $set: update }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Report updated'
    });
  } catch (error) {
    console.error('Error updating report:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update report'
    });
  }
});

// ============ DASHBOARD ENDPOINTS ============

app.get('/api/dashboard/freelancer/:id', async (req, res) => {
  try {
    const freelancerId = new ObjectId(req.params.id);
    const applications = db.collection('applications');
    const jobs = db.collection('jobs');
    const users = db.collection('users');

    // Fetch all applications by freelancer
    const apps = await applications.find({ freelancerId }).toArray();

    const totalApps = apps.length;
    const hiredApps = apps.filter((app) => app.status === 'hired');
    const pendingApps = apps.filter((app) => app.status === 'pending');

    // Potential earnings (sum job.budget where status hired)
    let potentialEarnings = 0;
    for (const app of hiredApps) {
      const job = await jobs.findOne({ _id: app.jobId });
      if (job && job.budget) potentialEarnings += job.budget;
    }

    // Recent activity (last 5 hired apps)
    const recentActivity = await Promise.all(
      hiredApps
        .sort((a, b) => b.appliedAt - a.appliedAt)
        .slice(0, 5)
        .map(async (app) => {
          const job = await jobs.findOne({ _id: app.jobId });
          return {
            jobTitle: job ? job.title : 'Unknown',
            date: app.appliedAt,
          };
        })
    );

    // Profile summary
    const freelancer = await users.findOne({ _id: freelancerId });
    let profileSummary = null;
    if (freelancer) {
      const { password, ...sanitized } = freelancer;
      profileSummary = sanitized.freelancerProfile || null;
    }

    return res.status(200).json({
      success: true,
      stats: {
        totalApps,
        hiredJobs: hiredApps.length,
        pendingApps: pendingApps.length,
        potentialEarnings,
      },
      recentActivity,
      profileSummary,
    });
  } catch (error) {
    console.error('Error fetching freelancer dashboard:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch dashboard' });
  }
});

app.get('/api/dashboard/client/:id', async (req, res) => {
  try {
    const clientId = new ObjectId(req.params.id);
    const jobs = db.collection('jobs');
    const applications = db.collection('applications');
    const users = db.collection('users');

    const clientJobs = await jobs.find({ clientId }).toArray();
    const jobIds = clientJobs.map((j) => j._id);

    const apps = await applications.find({ jobId: { $in: jobIds } }).toArray();

    const totalApplications = apps.length;
    const hiredApps = apps.filter((a) => a.status === 'hired');
    const hiredFreelancers = hiredApps.length;

    // total spent: sum budget of jobs where jobId in hiredApps
    let totalSpent = 0;
    const hiredJobIds = hiredApps.map((a) => a.jobId.toString());
    for (const job of clientJobs) {
      if (hiredJobIds.includes(job._id.toString()) && job.budget) totalSpent += job.budget;
    }

    // Active jobs (status open or in-progress)
    const activeJobs = clientJobs.filter((j) => j.status === 'open' || j.status === 'in-progress');

    // Recent applications (last 5)
    const recentApplications = await Promise.all(
      apps
        .sort((a, b) => b.appliedAt - a.appliedAt)
        .slice(0, 5)
        .map(async (app) => {
          const freelancer = await users.findOne({ _id: app.freelancerId });
          const job = clientJobs.find((j) => j._id.equals(app.jobId));
          return {
            freelancerName: freelancer ? freelancer.name : 'Unknown',
            jobTitle: job ? job.title : 'Unknown',
            status: app.status,
            appliedAt: app.appliedAt,
          };
        })
    );

    return res.status(200).json({
      success: true,
      stats: {
        jobsPosted: clientJobs.length,
        totalApplications,
        hiredFreelancers,
        totalSpent,
      },
      activeJobs,
      recentApplications,
    });
  } catch (error) {
    console.error('Error fetching client dashboard:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch dashboard' });
  }
});

// ============ SERVE HTML FILES ============

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('*', (req, res) => {
  const filePath = path.join(__dirname, req.path);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).send('Page not found');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
