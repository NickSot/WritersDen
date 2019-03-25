var express = require('express');
var router = express.Router();
var db = require('../config/database');
var nodePandoc = require('node-pandoc');

var chapterId;

router.get('/:bookId/like', (req, res) => {
    if (chapterId == undefined || req.session.user == undefined){
        req.flash('error', "Трябва да си логнат за да можеш да харесваш книги...");
        res.redirect('/');
        return;
    }
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

    db.query("Update Books Set Rating = Rating - 1 Where Id = ?");
});

router.get('/:id', (req, res) => {
    res.locals.authenticated = req.session.authenticated;

    chapterId = req.params.id;

    db.query('Select * From Chapters Where Id = ?', [chapterId], (err, chapters) => {
        db.query(`Select * From ChapterComments Inner Join Users On ChapterComments.PosterId
        =Users.Id Where ChapterId = ?;
        `, [chapterId], (err, result) => {
            let chapter = chapters[0];
            console.log("Current chapter is: ");
            console.log(chapter.BookId);
            
            if (chapter == undefined){
                req.flash('error', 'Няма таквъв url!');
                res.redirect('/');
                return;
            }
            
            if (chapter.Content != null){
                nodePandoc(chapter.Content, '-f markdown -t html5', (err, htmlContent) => {
                    res.render('chapter', {layout: false, chapter: chapter, commentUsers: result, htmlContent: htmlContent});
            
                });
            }
            else{
                res.render('chapter', {layout: false, chapter: chapter, commentUsers: result, htmlContent: null});
            }
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

module.exports = router;