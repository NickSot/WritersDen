var express = require('express');
var router = express.Router();
var db = require('../config/database');
var nodePandoc = require('node-pandoc');
var emailExistence = require('email-existence');
var transporter = require('../config/mailing');

var chapterId;

router.get('/:bookId/like', (req, res) => {
    if (chapterId == undefined || req.session.user == undefined){
        req.flash('error', "Трябва да си логнат за да можеш да харесваш книги...");
        res.redirect('/');
        return;
    }

    db.query('Select * From Chapters Where Id = ?', [chapterId], (err, chapters) => {
        if (chapters[0].ChapterPosted != 'Y' && chapters[0].ChapterPosted != 'y'){
            req.flash('error', 'Няма таквъв url!');
            res.redirect('/');
            return;
        }
    });

    // console.log("Book which is liked: " + req.params.bookId);
    db.query("Update Books Set Rating = Rating + 1 Where Id = ?", req.params.bookId, (err, resulting) => {
        // console.log(resulting);
        req.flash("success", "Харесано!");
        res.redirect('/catalog?page=1');
    });

})

router.get('/:id/dislike', (req, res) => {
    if (chapterId == undefined && req.session.user == undefined){
        res.redirect('/');
        return;
    }

    db.query('Select * From Chapters Where Id = ?', [chapterId], (err, chapters) => {
        if (chapters[0].ChapterPosted != 'Y' && chapters[0].ChapterPosted != 'y'){
            req.flash('error', 'Няма таквъв url!');
            res.redirect('/');
            return;
        }
    });

    db.query("Update Books Set Rating = Rating - 1 Where Id = ?");
});

router.get('/:id', (req, res) => {
    res.locals.authenticated = req.session.authenticated;

    chapterId = req.params.id;

    db.query('Select * From Chapters Inner Join Books On Books.Id = Chapters.BookId Where Chapters.Id = ?', [chapterId], (err, chapters) => {
        if (chapters.length == 0){
            req.flash('error', 'Няма таквъв url!');
            res.redirect('/');
            return;
        }

        if (chapters[0].ChapterPosted != 'Y' && chapters[0].ChapterPosted != 'y'){
            if (req.session.user.ID != chapters[0].AuthorId){
                req.flash('error', 'Няма таквъв url!');
                res.redirect('/');
                return;
            }
        }

        db.query(`Select * From ChapterComments Inner Join Users On ChapterComments.PosterId
        =Users.Id Where ChapterId = ?;
        `, [chapterId], (err, result) => {
            let chapter = chapters[0];
            
            if (chapter == undefined){
                req.flash('error', 'Няма таквъв url!');
                res.redirect('back');
                return;
            }

            db.query('Select * From Books Inner Join Chapters On Books.Id = Chapters.BookId Where Chapters.Id = ?', [chapterId], (err, bookChapter) => {
                if (req.session.authenticated){
                    res.locals.userId = req.session.user.ID;
                    res.locals.authorId = bookChapter[0].AuthorId;
                }
                else{
                    res.locals.userId = null;
                    res.locals.authorId = 0;
                }

                res.locals.bookId = bookChapter[0].BookId;

                if (chapter.Content != null){
                    nodePandoc(chapter.Content, '-f markdown -t html5', (err, htmlContent) => {
                        console.log(chapter);
                        res.render('chapter', {layout: false, chapter: chapter, commentUsers: result, htmlContent: htmlContent});
                    });
                }
                else{
                    console.log('CHAPTER: ');
                    console.log(chapter);
                    res.render('chapter', {layout: false, chapter: chapter, commentUsers: result, htmlContent: null});
                }
            });
        });
    });
});

router.post('/:id', (req, res) => {
    console.log('Commented!');
    let text = req.body.comment;

    if (!req.session.authenticated){
        req.flash('error', 'Не можеш да пишеш коментари, ако не си в акаунта си!');
        res.redirect('/chapter/' + chapterId);
    }
    else{
        db.query('Insert Into ChapterComments (Content, ChapterID, PosterId) Values (?, ?, ?)', [text, chapterId, req.session.user.ID], (err, result) => {
            if (err){
                throw err;
            }

            res.redirect('/chapter/' + chapterId);
        });
    }

});

router.get('/:id/post', (req, res) => {
    chapterId = req.params.id;
    
    db.query('Select * From Books Inner Join Chapters On Books.Id = Chapters.BookId Where Chapters.Id = ?', [chapterId], (err, chapter) => {
        if (!req.session.authenticated || req.session.user.ID != chapter[0].AuthorId){
            req.flash('Неправилен url!', 'success');
            res.redirect(`/chapter/${chapterId}`);
        }
        else{
            db.query(`Update Chapters Set ChapterPosted = 'Y' Where Id = ?`, [chapterId], (err, updateResult) => {
                if (err)
                    throw err;

                db.query(`Select * From Chapters Inner Join Books On Books.Id = Chapters.BookId Inner Join Followers On Followers.FollowingId = Books.AuthorId
            Inner Join Users On Users.ID = Followers.FollowerId Where Chapters.Id = ?
            `, [chapterId], (err, result) => {
                console.log('RESULT: ');
                console.log(result);

                result.forEach(element => {
                    emailExistence.check(element.Email, (err, response) => {
                        if (err)
                            throw err;

                        if (response){
                            let mailOptions = {
                                from: '"Feather Company" <feathers.land.original@gmail.com>', // sender address
                                to: element.Email, // list of receivers
                                subject: 'Здравей! :D', // Subject line
                                text: `Автор, за който сте се абонирали на име: <a href="localhost:3001/author/${req.session.user.ID}/show/">${req.session.user.username}</a>, издаде глава на книга!`, // plain text body
                                html: `<h1>Автор, за който сте се абонирали на име: ${req.session.user.username}, издаде глава на книга!<h1>`
                            };
            
                            transporter.sendMail(mailOptions, (error, info) => {
                                if (error) {
                                    console.log(error);
                                    res.status(400).send({success: false});
                                } else {
                                    res.status(200).send({success: true});
                                }
                            });
                        }

                        console.log('Sent mails!');

                        req.flash('Успешно публикуване на глава!', 'success');
                        res.redirect(`/chapter/${chapterId}`);
                    });
                });
            });
        });

        }
    });
});

module.exports = router;