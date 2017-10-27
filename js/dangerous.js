// fetch seed data from tracker
function fetchProjectData() {
  var token = document.getElementById("InputForm__token").value;
  var projectId = document.getElementById("InputForm__projectId").value;

  var fetchOptions = {
    credentials: 'omit',
    headers: new Headers({
      'content-type': 'application/json',
      'X-TrackerToken': token
    }),
    method: 'GET',
  };

  return window.fetch(`https://www.pivotaltracker.com/services/v5/projects/${projectId}?fields=name,stories`, fetchOptions)
    .then((response) => {
      if (response.status !== 200) {
        throw new Error();
      }

      response.json().then((json) => {
        document.getElementById("hideMe").style.display = 'none';
        startGame(json, token);
      });
    }).catch(() => {
      console.log('error');
    });
}

function deleteProject(projectId, token) {
  var fetchOptions = {
    credentials: 'omit',
    headers: new Headers({
      'content-type': 'application/json',
      'X-TrackerToken': token
    }),
    method: 'DELETE',
  };

  return window.fetch(`https://www.pivotaltracker.com/services/v5/projects/${projectId}`, fetchOptions)
    .then((response) => {
      if (response.status !== 200 && response.status !== 204) {
        throw new Error();
      }
    }).catch(() => {
      console.log('error');
    });
}

function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min;
}
// actual game stuff
function startGame(seedData, userToken) {
  var game = new Phaser.Game(800, 600, Phaser.AUTO, 'PhaserCanvas', { preload: preload, create: create, update: update });

  function preload() {
    game.load.image('feature', 'assets/feature.png');
    game.load.image('bug', 'assets/bug.png');
    game.load.image('chore', 'assets/chore.png');
    game.load.image('tracker', 'assets/tracker.png');
    game.load.image('tracker_bullet', 'assets/tracker_bullet.png');
    game.load.image('boss_background', 'assets/boss_background.png');
    game.load.image('boss_bullet', 'assets/boss_bullet.png');
    game.load.image('starfield', 'assets/starfield.png');
    game.load.spritesheet('kaboom', 'assets/explode.png', 128, 128);

    game.load.audio('blowUpTheMoon', ['assets/blowUpTheMoon.mp3', 'assets/blowUpTheMoon.ogg']);
  }

  var seedStories = seedData.stories;
  var projectName = seedData.name;

  var projectId = seedData.id;
  var token = userToken;

  var player;
  var bullets;
  var spaceKey;
  var stories;
  var boss;
  var bossText;
  var bossBullets;
  var bossHealth = 10;

  var waitToGameOverTime;

  var explosions;

  var bulletTime = 0;
  var totalEnemies = seedStories.length;
  var maxEnemies = totalEnemies > 3 ? 3 : totalEnemies;

  var destroyedStoriesCount = 0;

  var bossSpawned = false;
  var bulletsSpawned = false;
  var gameOver = false;

  function create() {
    //  We're going to be using physics, so enable the Arcade Physics system
    game.physics.startSystem(Phaser.Physics.ARCADE);

    game.add.sprite(0, 0, 'starfield');

    // The player and its settings
    player = game.add.sprite((game.world.width / 2) - 12, game.world.height - 50, 'tracker');

    //  We need to enable physics on the player
    game.physics.arcade.enable(player);
    player.body.collideWorldBounds = true;

    player.anchor.setTo(0.5, 0.5);

    // BULLETS!!!
    bullets = game.add.group();
    bullets.enableBody = true;
    bullets.physicsBodyType = Phaser.Physics.ARCADE;
    bullets.createMultiple(5, 'tracker_bullet');

    // KERSPLODERS!!!
    explosions = game.add.group();
    explosions.createMultiple(30, 'kaboom');
    explosions.forEach(setupExplosions, this);

    /*
      Behind the scenes, this will call the following function on all lasers:
        - events.onOutOfBounds.add(resetLaser)
      Every sprite has an 'events' property, where you can add callbacks to specific events.
      Instead of looping over every sprite in the group manually, this function will do it for us.
    */
    bullets.callAll('events.onOutOfBounds.add', 'events.onOutOfBounds', resetBullet);
    // Same as above, set the anchor of every sprite to 0.5, 1.0
    bullets.callAll('anchor.setTo', 'anchor', 0.5, 1.0);

    // This will set 'checkWorldBounds' to true on all sprites in the group
    bullets.setAll('checkWorldBounds', true);

    //  Finally some stories to destroy
    stories = game.add.group();
    stories.enableBody = true;

    // Create story objects in group
    for (var i = 0; i < maxEnemies; i++)
    {
        //  Create a star inside of the 'stories' group
        var story = stories.create(getRandomArbitrary(0,game.world.width - 32),5, seedStories[i].story_type);
    }
    seedStories.splice(0,maxEnemies);

    //  Our controls.
    cursors = game.input.keyboard.createCursorKeys();
    spaceKey = game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
    game.input.keyboard.addKeyCapture(Phaser.Keyboard.SPACEBAR);

    // music
    var music = game.add.audio('blowUpTheMoon');
    music.loop = true;
    music.volume = 0.3;
    music.play();
  }

  function update() {
    if (gameOver) {
      if (game.time.now > waitToGameOverTime) {
        game.world.removeAll();

        // win message here, maybe add a way to go back and delete another project?
        var style = { font: "36px Arial", fill: "#eee" };

        var winText = game.add.text(0, 0, 'YOU WIN!', style);
        winText.position.x = (game.width / 2) - (winText.width / 2);
        winText.position.y = (game.height / 2) - (winText.height / 2);

        document.getElementById("Button__reset").style.display = 'initial';
      }
    } else {
      //  Checks to see if the player overlaps with any of the stories, if he does call the killPlayer function
      game.physics.arcade.overlap(player, stories, killPlayer, null, this);

      // bullet stuff
      if (spaceKey.isDown) {
        fireBullet();
      }

      // blow up enemies who get hit by bullets
      game.physics.arcade.overlap(bullets, stories, killStory, null, this);

      // Enemy updates
      stories.forEach(function(story) {
        var ySeed = getRandomArbitrary(1, 10);
        if (ySeed > 5) {
          story.body.velocity.y = getRandomArbitrary(0, 200);
        } else if (ySeed < 4) {
          story.body.velocity.y = 0;
        }

        var xSeed = getRandomArbitrary(1, 3);
        if (xSeed < 2) {
          story.body.velocity.x = getRandomArbitrary(0, 200);
        } else if (xSeed < 3) {
          story.body.velocity.x = -1 * getRandomArbitrary(0, 200);
        } else {
          story.body.velocity.x = 0;
        }

        if (story.body.position.y > game.world.height) {
          story.body.position.y = -32;
        }

        if (story.body.position.x + 32 > game.world.width) {
          story.body.velocity.x = -1 * getRandomArbitrary(50, 200);
        } else if (story.body.position.x < 0) {
          story.body.velocity.x = getRandomArbitrary(50, 200);
        }
      });

      // used to control the 'slippery' movement after letting go of keys
      var slideFactor = 3;
      if (cursors.left.isDown)
      {
        //  Move to the left
        player.body.velocity.x = -150;
      }
      else if (cursors.right.isDown)
      {
        //  Move to the right
        player.body.velocity.x = 150;
      } else {
        if (player.body.velocity.x < 0) {
          player.body.velocity.x += slideFactor;
        } else if (player.body.velocity.x > 0) {
          player.body.velocity.x -= slideFactor;
        } else {
          player.body.velocity.x = 0;
        }
      }

      if (cursors.up.isDown)
      {
        player.body.velocity.y = -150;
      } else if (cursors.down.isDown)
      {
        player.body.velocity.y = 150;
      } else {
        if (player.body.velocity.y < 0) {
          player.body.velocity.y += slideFactor;
        } else if (player.body.velocity.y > 0) {
          player.body.velocity.y -= slideFactor;
        } else {
          player.body.velocity.y = 0;
        }
      }


      // boss movement
      if (bossSpawned) {
        if (!bulletsSpawned) {
          bulletsSpawned = true;
          bossBullets = game.add.group();
          bossBullets.enableBody = true;
          bossBullets.callAll('events.onOutOfBounds.add', 'events.onOutOfBounds', destroyBossBullet);
          bossBulletSpawnTime = game.time.now + 100;
        }
        // deal damage when boss gets hit OR boss hits us
        game.physics.arcade.overlap(bullets, boss, damageBoss, null, this);
        game.physics.arcade.overlap(player, boss, killPlayer, null, this);
        game.physics.arcade.overlap(bossBullets, player, killPlayer, null, this);

        if (bossHealth === 0) {
          boss.destroy();
          bossText.destroy();

          var explosion = explosions.getFirstExists(false);
          explosion.reset(bossText.x, bossText.y);
          explosion.play('kaboom', 30, false, true);

          gameOver = true;
          deleteProject(projectId, token);

          waitToGameOverTime = game.time.now + 1000;
        } else {
          if (boss.body.position.x <= 0) {
            boss.body.velocity.x = 200;
          } else if (boss.body.position.x + 300 >= game.world.width) {
            boss.body.velocity.x = -200;
          }

          bossText.x = Math.floor(boss.x + boss.width / 2);
          bossText.y = Math.floor(boss.y + boss.height / 2);

          // boss bullets
          if (game.time.now > bossBulletSpawnTime) {
            var bBullet = bossBullets.create(boss.body.position.x + (boss.width / 2), boss.body.position.y + boss.height, 'boss_bullet');
            bBullet.enableBody = true;
            var bulletSeed = getRandomArbitrary(1,10);
            bBullet.body.velocity.x = bulletSeed > 5 ? (-80 - (bulletSeed * 10)) : (80 + (bulletSeed * 10));
            bBullet.body.velocity.y = (100 + (bulletSeed * 10));
            bossBulletSpawnTime = game.time.now + 1000;
          }
        }
      }
    }
  }

  function killPlayer() {
    player.kill();

    var explosion = explosions.getFirstExists(false);
    explosion.reset(player.body.x, player.body.y);
    explosion.play('kaboom', 30, false, true);

    player.reset((game.world.width / 2) - 12, game.world.height - 50);
  }

  function killStory(bullet, story) {
    bullet.kill();
    story.destroy();

    var explosion = explosions.getFirstExists(false);
    explosion.reset(story.body.x, story.body.y);
    explosion.play('kaboom', 30, false, true);

    destroyedStoriesCount += 1;
    if ((destroyedStoriesCount + stories.children.length) < totalEnemies) {
      var story = stories.create(getRandomArbitrary(0,game.world.width - 32),5, seedStories[0].story_type);
      seedStories.splice(0,1);
    } else if (stories.children.length === 0 && !bossSpawned) {
      spawnProjectBoss();
    }
  }

  function damageBoss(boss, bullet) {
    bullet.kill();
    bossHealth -= 1;
  }

  function resetBullet(bullet) {
  	// Destroy the bullet
  	bullet.kill();
  }

  function destroyBossBullet(bBullet) {
    bBullet.destroy();
  }

  function fireBullet() {
    if (game.time.now > bulletTime)
    {
        bullet = bullets.getFirstExists(false);
        if (bullet)
        {
            bullet.reset(player.body.position.x + 18, player.body.position.y - 2);
            bullet.body.velocity.y = -300;
            bulletTime = game.time.now + 250;
        }
    }
  }

  function spawnProjectBoss() {
    bossSpawned = true;

    // initial boss state
    boss = game.add.sprite(300, 40, 'boss_background');
    game.physics.arcade.enable(boss);
    boss.enableBody = true;
    boss.body.collideWorldBounds = true;
    boss.body.velocity.x = 200;

    var style = { font: "24px Arial", fill: "#eee" };

    bossText = game.add.text(0, 0, projectName, style);
    bossText.anchor.set(0.5);
  }

  function setupExplosions(story) {
    story.anchor.x = 0.5;
    story.anchor.y = 0.5;
    story.animations.add('kaboom');
  }
}
