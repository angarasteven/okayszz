const robberyStories = [
  "🏦 You cased the bank for weeks, studying the routines and security measures. Finally, the day arrived. You donned your disguise and slipped inside, heart pounding as you approached the tellers with your weapon drawn. Little did you know, the security guard recognized you from your high school days...",
  "👻 The abandoned warehouse seemed like the perfect hideout after your daring jewelry store heist. But as you settled in, strange noises began echoing through the empty halls. Were you being haunted by the ghosts of robberies past, or was something more sinister afoot?",
  "🕵️‍♀️ You thought you had planned the perfect art museum robbery, but you didn't account for the wits of the security consultant they had recently hired - your former partner from your days in the police force. Now it's a game of cat-and-mouse as they try to outwit you.",
  "🚗 The getaway car was supposed to be your ticket to freedom after the armored truck robbery. But when you reached the rendezvous point, your driver was nowhere to be found. Stranded with the loot, you realized you'd been double-crossed by one of your own crew.",
  "🎭 To pull off the diamond heist, you had to infiltrate the city's most exclusive masquerade ball. But as you mingled with the wealthy guests, you found yourself drawn into a web of secrets and lies that threatened to unravel your entire plan.",
  "⌚ Time was running out as you raced to crack the bank vault's intricate locking mechanism. With each passing second, the risk of being caught increased. Would you be able to escape with the riches before the security system was triggered?",
  "🌉 The bridge heist was supposed to be a simple smash-and-grab, but you didn't anticipate the thick fog that rolled in, obscuring your escape route. Now you're lost in the labyrinth of streets, with the sound of police sirens drawing ever closer.",
  "🎥 You thought robbing the movie studio would be an easy score, but you didn't count on being mistaken for one of the actors and getting caught up in the filming of an action-packed heist sequence. Can you improvise your way out of this mess?",
  "🏰 The medieval castle's vault was rumored to contain priceless artifacts and treasures. But as you descended into the depths, you realized you weren't the only one after the loot – a rival gang of thieves was hot on your trail.",
  "🚂 The train heist was going according to plan until a sudden derailment left you and your crew stranded in the middle of nowhere with the stolen cargo. Now you must navigate the treacherous wilderness while evading the authorities.",
  "🛥️ You and your crew had meticulously planned the yacht heist, but a sudden storm threw a wrench into your plans. As the waves crashed against the deck, you realized that escaping with the loot would be your greatest challenge yet.",
  "🎸 The rock star's mansion was supposed to be an easy target, but you didn't anticipate running into the musician himself. Now you find yourself caught up in a whirlwind of fame, fortune, and questionable life choices.",
  "🏯 The ancient temple held untold riches, but also deadly traps and curses. As you delved deeper into its depths, you began to question whether the treasure was worth the risk of unleashing an ancient evil upon the world.",
  "🚘 The armored car heist was a success, but as you sped away with the cash, you realized one of your crew had been injured during the getaway. Now you must choose between abandoning them or risking it all to get them to safety.",
  "💍 The jewelry store robbery was a spur-of-the-moment decision, but as you fled with the sparkling gems, you realized one of them was a priceless family heirloom. Now you must grapple with your conscience and decide whether to return it or disappear forever."
];

function generateRobberyStory() {
  const randomIndex = Math.floor(Math.random() * robberyStories.length);
  return robberyStories[randomIndex];
}

module.exports = {
  generateRobberyStory
};
