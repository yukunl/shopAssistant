const express = require('express')
const { WebhookClient } = require('dialogflow-fulfillment')
const app = express()
const fetch = require('node-fetch')
const base64 = require('base-64')

let username = "";
let password = "";
let token = "";

USE_LOCAL_ENDPOINT = false;
// set this flag to true if you want to use a local endpoint
// set this flag to false if you want to use the online endpoint
ENDPOINT_URL = ""
if (USE_LOCAL_ENDPOINT) {
  ENDPOINT_URL = "http://127.0.0.1:5000"
} else {
  ENDPOINT_URL = "https://mysqlcs639.cs.wisc.edu"
}



async function getToken() {
  let request = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + base64.encode(username + ':' + password)
    },
    redirect: 'follow'
  }

  const serverReturn = await fetch(ENDPOINT_URL + '/login', request)
  const serverResponse = await serverReturn.json()
  token = serverResponse.token
  if (!token) {
    agentMessage("Oops, wrong password or username. Try sign in again")
  }
  return token;
}

async function userMessage(message){
  let request = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      "x-access-token": token
    },
    body:JSON.stringify({
      isUser : true,
      text :message,
    }),
    redirect: 'follow'
  }
  await fetch( ENDPOINT_URL + '/application/messages', request)
}


async function navigateToPage (page) {
  if(page !== "/signIn" && page !== "/signUp"){
    page =  '/' + username  + page;
  }
  let request = {
    method: 'PUT',
    headers: {'Content-Type': 'application/json',
              'x-access-token': token },
    body: JSON.stringify({ page:  page, 
                           dialogflowUpdated: true,
                           back: false}),
    redirect: 'follow'
  }
  const serverReturn = await fetch(ENDPOINT_URL + '/application', request);
  const serverResponse = await serverReturn.json()
  return serverResponse;
}



async function clearChat(){
  let request = {
    method: 'DELETE',
    headers: {'Content-Type': 'application/json',
              'x-access-token': token },
    redirect: 'follow'
  }
  const serverReturn = await fetch(ENDPOINT_URL + '/application/messages', request);
  return;
}


app.get('/', (req, res) => res.send('online'))
app.post('/', express.json(), (req, res) => {
  const agent = new WebhookClient({ request: req, response: res })

  function welcome() {
    agent.add('Webhook works!')
    console.log(ENDPOINT_URL)
  }

  async function login() {
    // You need to set this from `username` entity that you declare in DialogFlow
    username = agent.parameters.username
    // You need to set this from password entity that you declare in DialogFlow
    password = agent.parameters.password
    try {
      token = await getToken()
      // if(!token ){
      //   agent.add("Oops, wrong password or username")
      // }
      agent.add("you are logged in!")
    } catch {
      agent.add("Oops, wrong password or username")
      return;
    }
    await clearChat()
    navigateToPage("/")
    await agentMessage("Hello! We are very honored to have you in our shop " + username + "! Please let me know if I can assist you with anything!")
  }

  async function tagList() {
    let c = agent.parameters.category

    let request = {
      method: 'GET'
    }
    const serverReturn1 = await fetch(ENDPOINT_URL + '/categories/' + c + '/tags', request);
    const serverResponse1 = await serverReturn1.json()
    let tags = serverResponse1.tags;
    
    navigateToPage("/" + c)
    agentMessage(" Here is what we have! ")
  }

  async function categorylist() {
    let request = {
      method: 'GET',
      headers: { "x-access-token": token },
      redirect: 'follow'
    }
    const serverReturn = await fetch(ENDPOINT_URL + '/categories', request);
    const serverResponse = await serverReturn.json()
    let categories = serverResponse.categories;
    let message = "We have a beautiful collection of "
    for(let i = 0; i < categories.length - 1; i++){
          message += categories[i] + ", "
    }
    message += categories[categories.length - 1] + ". "
    message += "Would you like to see any of them in detail?"
    navigateToPage("/")
    await agentMessage(message);
  }


  async function applyTagFilter() { // add to dialogflow
    let tag = agent.parameters.tag
   let request = {
      method: 'POST',
      headers: {'x-access-token': token },
      redirect: 'follow'
    }
    //for await (const t of tag) {
      const serverReturn = await fetch(ENDPOINT_URL + '/application/tags/' + tag, request)
      if (!serverReturn.ok) {
        agentMessage("Sorry, We do not have this tag for items yet. Maybe search for other tags?");
        return;
      }  
    //}
      const serverResponse = await serverReturn.json()
    agentMessage("Alright! Here are all " + tag + " products!");

  }




  async function cartList() {
    let request = {
      method: 'GET',
      headers: { 'x-access-token': token },
      redirect: 'follow'
    }
    if (!token) {
      await agentMessage("Sorry! You are not logged in! ");
    }
    const serverReturn = await fetch(ENDPOINT_URL + '/application/products', request);

    if (!serverReturn.ok) {
      agentMessage("Sorry, we are unable to load this page");
      return; 
    }  
    const serverResponse = await serverReturn.json()
    let products = serverResponse.products;
    console.log(products.length)
    let sum = 0;
    let message = "We currently have ";
    if(products.length === 0){
      await agentMessage("Nothing in cart yet!");
      return;
    }
    for(let i = 0; i < products.length -1 ; i++){
      console.log(i)
      message += products[i].count + " " + products[i].name + ", "
      sum += products[i].price * products[i].count;
    }
    sum += products[products.length -1].price * products[products.length -1].count;
    message += products[products.length -1].count + " " + products[products.length -1].name
    message += " in your cart! Our subtotal at the moment is $" + sum
    await agentMessage(message);

  }
  

  async function productInfo() {
    let productName = agent.parameters.product
    console.log(productName)
    //agent.add(productName)
    let request = {
      method: 'GET',
      headers: { "x-access-token": token },
      redirect: 'follow'
    }

    const serverReturn = await fetch(ENDPOINT_URL + '/products', request);
    const serverResponse = await serverReturn.json()
    let products = serverResponse.products;
    let message = "Sure!  "
    let productid = "" 
    for(let i = 0; i < products.length; i++){
      if(products[i].name === productName){
        message += products[i].description
        productid = products[i].id
        let category = products[i].category
        navigateToPage("/"+category + "/products/" + productid)
        break;
      }
    }
    agentMessage(message);
    

  }

  async function agentMessage(message){
    let request = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        "x-access-token": token
      },
      body:JSON.stringify({
        isUser : false,
        text: message,
      }),
      redirect: 'follow'
    }
    agent.add(message)
    await fetch( ENDPOINT_URL + '/application/messages',request)
  
  }

 async function addItemtoCart() {
    const product = agent.parameters.product
    let request = {
      method: 'GET',
      headers: { "x-access-token": token },
      redirect: 'follow'
    }
    const serverReturn = await fetch(ENDPOINT_URL + '/products', request);
    const serverResponse = await serverReturn.json()
    let allproducts = serverResponse.products;
    let productid = ""
    for(let i = 0; i < allproducts.length; i++){
      if(allproducts[i].name === product){
        productid = allproducts[i].id
        break;
      }
    }
    let request2 = {
      method: 'POST',
      headers: {'x-access-token': token },
      redirect: 'follow'
    }
      const serverReturn2 = await fetch(ENDPOINT_URL + '/application/products/' + productid, request2)

      if (!serverReturn2.ok) {
        agentMessage("Oh no! We encountered a problem adding" + product +"to the cart... Try again?");
        return;
      } 
      agentMessage("Ok! We have " + product + " in your cart!");

  }

 async function deleteCartItem() {
    const product = agent.parameters.product

    let request = {
      method: 'GET',
      headers: { "x-access-token": token },
      redirect: 'follow'
    }
    const serverReturn = await fetch(ENDPOINT_URL + '/products', request);
    const serverResponse = await serverReturn.json()
    let allproducts = serverResponse.products;
    let productid = ""
    for(let i = 0; i < allproducts.length; i++){
      if(allproducts[i].name === product){
        productid = allproducts[i].id
        break;
      }
    }
    let request2 = {
      method: 'DELETE',
      headers: {'x-access-token': token },
      redirect: 'follow'
    }
      const serverReturn2 = await fetch(ENDPOINT_URL + '/application/products/' + productid, request2)

      if (!serverReturn2.ok) {
        agentMessage(product + "is not in the cart~");
        return;
      } 
      agentMessage("Ok! I have took " + product + " out of your cart!");

  }


  async function review() {
    if (!token) {
      agentMessage("Oh no! You are signed out. Sign in and try again!")
    }
    navigateToPage("/cart-review")
    agentMessage('We currently have these in the cart, is this all we would like today?')

  }

  async function confirm() {
    const userrespond = agent.parameters.userResponse
    if (!token) {
      agentMessage("Oh no! You are signed out. Sign in and try again!")
    }
    if (userrespond === "yes") {
      navigateToPage("/cart-confirmed")
      agentMessage('Alright! Thank you so much for shopping with us here at WiscShop. We can not wait to see you shop in another time!')
      return;
    }else{

      agentMessage('Ok! Would you like to add or delete any items? Please let me know!')

    }
  }

  async function showReviewForItem () {
    const product = agent.parameters.product
    // get product
    let request = {
      method: 'GET',
      headers: { "x-access-token": token },
      redirect: 'follow'
    }
    const serverReturn = await fetch(ENDPOINT_URL + '/products', request);
    const serverResponse = await serverReturn.json()
    let allproducts = serverResponse.products;
    let productid = ""
    for(let i = 0; i < allproducts.length; i++){
      if(allproducts[i].name === product){
        productid = allproducts[i].id
        break;
      }
    }
    
    // get review
    let request2 = {
    method: 'GET',
    redirect: 'follow'
     }

    const serverReturn2 = await fetch(ENDPOINT_URL + '/products/' + productid + '/reviews', request2);
  if (!serverReturn.ok) {
    agentMessage("Oops having trouble getting the review... Did you type the name of our product correctly?")
  }
  const serverResponse2 = await serverReturn2.json()
  const reviews = serverResponse2.reviews;
  if(reviews.length === 0){
    agentMessage("Oops, there are currently no reviews for this product. Be the first one to try it!")
  }
  let sum = 0
  for(let i = 0; i < reviews.length; i++){
      sum += reviews[i].stars
  }
  let avg = sum/reviews.length
  let message ="The average rateing for " + product + "is " + avg + " a review of this is: " + reviews[0].text;
  agentMessage(message)
  }

  async function navigate() {
    const page = agent.parameters.pageName
    //console.log(page)
    if (page === "home") {
     await navigateToPage('/')
    } 
    if (page === "signIn") {
      await navigateToPage('/signIn')
    } 
    if (page === "signUp") {
      await navigateToPage('/signUp')
    }
    if (page === "cart") {
      if (!token) {
        agentMessage("Oh no! You are not signed in yet. You can try again when you sign in!");
        return;
      }
      await navigateToPage('/cart')
    } 
    agentMessage("You are now in " + page);

  
  }

  //post user message
  //post agent message json.stringfy boolean (is user) 


  let intentMap = new Map()
  intentMap.set('Default Welcome Intent', welcome)
  // You will need to declare this `Login` content in DialogFlow to make this work
  intentMap.set('login', login)
  intentMap.set('categorylist', categorylist)
  intentMap.set('tagList', tagList)
  intentMap.set('cartInformation', cartList)
  intentMap.set('productInfo', productInfo)
  intentMap.set('navigation', navigate)
  intentMap.set('tagfiltier', applyTagFilter)
  intentMap.set('deleteCartItem', deleteCartItem)
  intentMap.set('addItemtoCart', addItemtoCart)
  intentMap.set('review', review)
  intentMap.set('confirm', confirm)
  intentMap.set('reviewOfItem', showReviewForItem)
  
  // implement navigation in each function
  //add cart review
  //add card confirm
  
  userMessage(agent.query)
  agent.handleRequest(intentMap)
})

app.listen(process.env.PORT || 8080)
