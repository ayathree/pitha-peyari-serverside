const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express();

const corsOptions = {
  origin : ['http://localhost:5173','http://localhost:5174', 'https://pitha-peyari-23917.web.app'],
  credentials : true,
  optionSuccessStatus : 200,

 }

 

 app.use(cors(corsOptions))
app.use(express.json());
app.use(cookieParser())

// verifyToken middleware
const verifyToken=(req,res,next)=>{
   const token = req.cookies?.token
        if(!token) return res.status(401).send({message:'unauthorized access'})
          if(token){
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
              if(err){
                console.log(err)
                return res.status(401).send({message:"unauthorized access"})
              }
              console.log(decoded)
              req.user=decoded
              next()
            })
          }
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ycbv1lf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const itemCollection = client.db("pithaPeyariDB").collection("item");
    const cartCollection = client.db("pithaPeyariDB").collection("cart");
    const wishCollection = client.db("pithaPeyariDB").collection("wishList");
    const orderCollection = client.db("pithaPeyariDB").collection("order");
    const reviewCollection = client.db("pithaPeyariDB").collection("review");
    const userCollection = client.db('pithaPeyariDB').collection('users');
    const contactCollection = client.db('pithaPeyariDB').collection('contact');


    // jwt token
    app.post('/jwt', async(req,res)=>{
      const user = req.body
      const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{
        expiresIn:'365d'
      })
      res.cookie('token', token,{
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite:process.env.NODE_ENV === 'production'?'none':'strict',
      }).send({success:true})
    })

    // clear cookie
     app.get('/logout', async(req,res)=>{
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production'?'none':'strict',
        maxAge:0,
      }).send({success: true})
    })


    // save a user in db
   app.post('/allUsers', async (req, res) => {
  const user = req.body;
  
  // Check by email OR uid if available
  const query = { 
    $or: [
      { email: user.email },
      ...(user.uid ? [{ uid: user.uid }] : [])
    ]
  };

  const existingUser = await userCollection.findOne(query);
  
  if (existingUser) {
    // Update last login but preserve role
    await userCollection.updateOne(
      { _id: existingUser._id },
      { $set: { lastLogin: new Date() } }
    );
    return res.send({ 
      message: 'user exists', 
      user: existingUser 
    });
  }

  // New user with default role
  const userWithDefaults = {
    ...user,
    role: 'user',
    createdAt: new Date(),
    lastLogin: new Date()
  };

  const result = await userCollection.insertOne(userWithDefaults);
  res.send({
    message: 'new user created',
    user: { ...userWithDefaults, _id: result.insertedId }
  });
});


   
       // get all user data
        app.get('/allUsers', verifyToken, async(req,res)=>{
          const result = await userCollection.find().toArray()
    
          res.send(result)
        })

     
      // get the user role
  app.get('/allUsers/admin/:email', verifyToken,  async(req,res)=>{
       const email = req.params.email;
      //  if (email !== req.decoded.email) {
      //    return res.status(403).send({message: 'unauthorized access'})
         
      //  }
       const query = {email: email};
       const user = await userCollection.findOne(query);
       let admin = false;
       if (user) {
         admin = user?.role=== 'admin';
         
       }
       res.send({ admin})
 
     })

// admin route
    // app.get('/allUsers/admin/:email', async (req, res) => {
    //   try {
    //     // 1. Get the requesting user's email from the verified token
    //     const requestingUserEmail = req.user.email;
    //     console.log(requestingUserEmail); // From verifyToken middleware
        
    //     // 2. Get the target email from params
    //     const targetEmail = req.params.email;
    //     console.log(targetEmail);
    
    //     // 3. Find the requesting user in database
    //     const requestingUser = await userCollection.findOne({ email: requestingUserEmail });
    //     console.log(requestingUser);
        
    //     // 4. Authorization check - only allow if:
    //     //    a) User is checking their own status, OR
    //     //    b) User is an admin
    //     if (requestingUserEmail !== targetEmail && requestingUser?.role !== 'admin') {
    //       return res.status(403).json({ message: 'Unauthorized access' });
    //     }
    
    //     // 5. Proceed with the admin check
    //     const targetUser = await userCollection.findOne({ email: targetEmail });
    //     res.json({ 
    //       admin: targetUser?.role === 'admin',
    //       email: targetEmail
    //     });
    //     console.log(targetUser);
    
    //   } catch (err) {
    //     console.error('Admin check error:', err);
    //     res.status(500).json({ message: 'Server error' });
    //   }
    // });

   

    // save a pitha item in database
    app.post('/addItem',async(req,res)=>{
      const itemData = req.body
       // Convert price to number (float)
    if (itemData.price) {
      itemData.price = parseFloat(itemData.price);
    }
      
      const result = await itemCollection.insertOne(itemData)
      res.send(result)
    })

    // get all pitha data
    app.get('/addItem', async(req,res)=>{
      const result = await itemCollection.find().toArray()

      res.send(result)
    })

    // get all item data save by admin
    app.get('/itemsData/:email', verifyToken, async(req,res)=>{
      const email = req.params.email
      const query = {adminEmail : email}
      const result =await itemCollection.find(query).toArray()
      res.send(result)
    })
    // delete a item data from db
    app.delete('/itemData/:id', verifyToken, async(req,res)=>{
      const id = req.params.id
      const query = {_id : new ObjectId(id)}
      
      const result =await itemCollection.deleteOne(query)
      res.send(result)
    })
    // get all single item data

    app.get('/items/:id', async(req,res)=>{
      const id= req.params.id
      const query = {_id: new ObjectId (id)}
      console.log(query)
      const result = await itemCollection.findOne(query)
      res.send(result)
    })
    //  update a item data 
    app.put('/itemData/:id', verifyToken, async(req,res)=>{
      const id = req.params.id
      const productData = req.body
      const query = {_id : new ObjectId(id)}
      const options = {upsert: true}
      const updateDoc={
        $set:{
          ...productData,
        },
      }
      const result = await itemCollection.updateOne(query,updateDoc,options)
      res.send(result)
      
    })
     // get all item data by category name
    app.get('/itemCategory/:category', async(req,res)=>{
      const category=decodeURIComponent (req.params.category)
     const query = { 
     category: { $regex: new RegExp(`^${category}$`, 'i') }
    };
      console.log(query)
      const result = await itemCollection.find(query).toArray()
      res.send(result)
    })

    // save a product in cart
     app.post('/cart', async(req,res)=>{
      const cartData = req.body
      // check if the order is duplicate
      const query={
        customerEmail:cartData.customerEmail,
        cartProductId:cartData.cartProductId
      }
      const alreadySaved=await cartCollection.findOne(query)
      if(alreadySaved){
        return res.status(400).send('You have already added this product')
      }
      const result = await cartCollection.insertOne(cartData)
      res.send(result)
    })

    // get all cart product
    app.get('/cart/:email', verifyToken, async(req,res)=>{
      const email = req.params.email
      const query = {customerEmail : email}
      const result =await cartCollection.find(query).toArray()
      res.send(result)
    })

    // delete a cart data from db
    app.delete('/cartData/:id', verifyToken, async(req,res)=>{
      const id = req.params.id
      const query = {_id : new ObjectId(id)}
      
      const result =await cartCollection.deleteOne(query)
      res.send(result)
    })

    // get all single cart data

     app.get('/cartData/:id', verifyToken, async(req,res)=>{
      const id= req.params.id
      const query = {_id: new ObjectId (id)}
      console.log(query)
      const result = await cartCollection.findOne(query)
      res.send(result)
    })
    // PATCH /cartData/:id - Update cart item quantity
app.patch('/cartData/:id', verifyToken, async (req, res) => {
  try {
      const id = req.params.id;
      const { quantity } = req.body;
      
      // Validate input
      if (!quantity || isNaN(quantity)) {
          return res.status(400).json({ error: 'Valid quantity is required' });
      }

      const result = await cartCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { quantity: parseInt(quantity), updatedAt: new Date() } }
      );

      if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'Cart item not found' });
      }

      res.json({ success: true });
  } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
  }
});

// get all cart data for checkout of a user from db
app.get('/checkOutData/:email', verifyToken, async(req,res)=>{
  const email = req.params.email
  const query = {customerEmail : email}
  const result =await cartCollection.find(query).toArray()
  res.send(result)
})

    // add a wish listed product in database
    app.post('/wish', async(req,res)=>{
      const wishData = req.body
      // check if the order is duplicate
      const query={
        listerEmail:wishData.listerEmail,
        listedProductId:wishData.listedProductId
      }
      const alreadyListed=await wishCollection.findOne(query)
      if(alreadyListed){
        return res.status(400).send('You have already added this product')
      }
      
      const result = await wishCollection.insertOne(wishData) 
      res.send(result)
    })

     // add a listed product in cart
    app.post('/wishData', async (req, res) => {

      try {
        // 1. Add to cart
        const cartItem = {
          ...req.body,
          addedAt: new Date()
        };
        const result = await cartCollection.insertOne(cartItem);
    
        // 2. Delete from wishlist (simple version)
        await wishCollection.deleteOne({
          _id: new ObjectId(req.body.cartProductId), // Assume frontend sends wishItemId
          listerEmail: req.body.customerEmail // Matches cart item's saverEmail
        });
    
        res.send(result);
      } catch (error) {
        res.status(500).send('Error');
      }
    });

     // get all wish listed product of a user from db
    app.get('/wish/:email', verifyToken, async(req,res)=>{
     
      const email = req.params.email
      
      const query = {listerEmail : email}
      const result =await wishCollection.find(query).toArray()
      res.send(result)
    })
    // delete a wishListed  data from db
    app.delete('/wishData/:id', verifyToken, async(req,res)=>{
      const id = req.params.id
      const query = {_id : new ObjectId(id)}
      
      const result =await wishCollection.deleteOne(query)
      res.send(result)
    })

    // save a order in database
    app.post('/order', async(req,res)=>{
      const id = req.params.id
      const orderData = req.body
      // check if the order is duplicate
      const query={
        _id : new ObjectId(id),
       'customerInfo.email': orderData.customerInfo.email,   
      }
      const alreadyOrdered=await orderCollection.findOne(query)
      if(alreadyOrdered){
        return res.status(400).send('You have already ordered this product')
      }
      
      const result = await orderCollection.insertOne(orderData)
     // Update order count for each product
    // await Promise.all(
    //   orderData.products.map(product => 
    //     productCollection.updateOne(
    //       { _id: new ObjectId(product.id) }, // Fix: Single ID per update
    //       { $inc: { totalOrder: 1 } }
    //     )
    //   )
    // );

    // 6. Remove ordered items from cart
    const productIds = orderData.products.map(p => p.id);
    await cartCollection.deleteMany({
      'cartProductId': { $in: productIds },
      'customerEmail': orderData.customerInfo.email
    });
      res.send(result)
    })

    // get all single order data by customer email

    // app.get('/orderData/:email',  async(req,res)=>{
    //   const email= req.params.email
    //   const query = {'customerInfo.email': email}
    //   console.log(query)
    //   const result = await orderCollection.find(query).toArray()
    //   res.send(result)
    // })
   
     // get all order of a user from db
    app.get('/order/:email', verifyToken, async(req,res)=>{
      
      const email = req.params.email
      const query = {'customerInfo.email' : email}
      const result =await orderCollection.find(query).toArray()
      res.send(result)
    })

    // get all order of a user for a admin from db
    app.get('/orderAdmin/:email', verifyToken, async(req,res)=>{
      
      const email = req.params.email
     
      const query = { 'products.owner' : email}
      const result =await orderCollection.find(query).toArray()
      res.send(result)
    })

    // get all single order data

    app.get('/orderData/:id', verifyToken, async(req,res)=>{
      const id= req.params.id
      const query = {_id: new ObjectId (id)}
      console.log(query)
      const result = await orderCollection.findOne(query)
      res.send(result)
    })
    //  update a order data 
    app.patch('/orderData/:id', verifyToken, async(req,res)=>{
      const id = req.params.id
      const { name, phone, address, city, zipCode } = req.body;
      const query = {_id: new ObjectId(id)}
      const updateDoc ={
        $set: {
         'customerInfo.name': name,
        'customerInfo.phone': phone,
        'customerInfo.address': address,
        'customerInfo.city': city,
        'customerInfo.zipCode': zipCode,
        }
      }
      const result = await orderCollection.updateOne(query, updateDoc)
      res.send(result)
      
    })

    // delete a order data from db
    app.delete('/orderData/:id', verifyToken, async(req,res)=>{
      const id = req.params.id
      const query = {_id : new ObjectId(id)}
      
      const result =await orderCollection.deleteOne(query)
      res.send(result)
    })

    // update status
    app.patch('/order/:id', verifyToken, async (req,res)=>{
      const id=req.params.id
      const { status } = req.body
      const query = {_id: new ObjectId(id)}
      const updateDoc ={
        $set: {
        'orderDetails.status': status,
        
      }
      }
      const result = await orderCollection.updateOne(query, updateDoc)
      res.send(result)
    })

      // add a review in database
    app.post('/review', async(req,res)=>{
      const reviewData = req.body
      // check if the review is duplicate
      const query={
        reviewerEmail:reviewData.reviewerEmail,
        reviewedProductId:reviewData.reviewedProductId
      }
      const alreadyReviewed=await reviewCollection.findOne(query)
      if(alreadyReviewed){
        return res.status(400).send('You have already added this product')
      }
      
      const result = await reviewCollection.insertOne(reviewData) 
      res.send(result)
    })
   
    // Get all reviews for a specific product by product ID
app.get('/products/:productId/reviews', async (req, res) => {
  try {
    const productId = req.params.productId;
    
    // Find all reviews where reviewedProductId matches the product's _id
    const reviews = await reviewCollection.find({
      reviewedProductId: productId  // This matches the string ID from URL with reviewedProductId
    }).toArray();
    
    res.send(reviews);
    
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// adding messages in database
 app.post('/contacts', async (req, res) => {
      const contact = req.body;
      const result = await contactCollection.insertOne(contact);
      res.send(result);
    });

// get message from db 
 app.get('/contacts', verifyToken, async(req,res)=>{
      const result = await contactCollection.find().toArray()
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req,res)=>{
    res.send('pitha peyari running')
});

app.listen(port, ()=>{
    console.log(`pitha peyari is running on port: ${port}`)
})